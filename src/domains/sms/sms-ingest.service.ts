import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { KvService } from '../../integrations/kv/kv.service';
import { AppConfigService } from '../../config/app-config.service';
import { SmsAiService } from './sms-ai.service';
import {
  SmsHandler,
  SmsJob,
  SMS_HANDLER,
} from './interfaces/sms-handler.interface';
import { IngestSmsDto } from './dto/ingest-sms.dto';
import { SmsIngestResponseDto } from './dto/sms-ingest-response.dto';

@Injectable()
export class SmsIngestService {
  private readonly logger = new Logger(SmsIngestService.name);

  constructor(
    private readonly kvService: KvService,
    private readonly aiService: SmsAiService,
    private readonly config: AppConfigService,
    @Optional() @Inject(SMS_HANDLER) private readonly handlers: SmsHandler[],
  ) {
    this.handlers = handlers ?? [];
  }

  /**
   * Normalize SMS content for fingerprint calculation.
   * Strips leading/trailing whitespace and collapses consecutive whitespace.
   */
  private normalizeContent(content: string): string {
    return content.trim().replace(/\s+/g, ' ');
  }

  /**
   * Bucket a timestamp to the nearest minute (floor).
   * If no timestamp is given, uses the current server time.
   */
  private getTimeBucket(receivedAt?: string): string {
    const ms = receivedAt ? new Date(receivedAt).getTime() : Date.now();
    const bucketed = Math.floor(ms / 60_000) * 60_000;
    return new Date(bucketed).toISOString();
  }

  /**
   * Compute a stable fingerprint for deduplication.
   * Uses contentNormalized + receivedAtBucket (+ optional sender) as input.
   */
  computeFingerprint(dto: IngestSmsDto): string {
    const contentNorm = this.normalizeContent(dto.content);
    const bucket = this.getTimeBucket(dto.receivedAt);
    const senderNorm = dto.sender ? dto.sender.trim() : '';
    const raw = `${senderNorm}|${bucket}|${contentNorm}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  private dedupKey(fingerprint: string): string {
    return `sms:ingest:dedup:${fingerprint}`;
  }

  async ingest(dto: IngestSmsDto): Promise<SmsIngestResponseDto> {
    const fingerprint = this.computeFingerprint(dto);
    const key = this.dedupKey(fingerprint);
    const ttl = this.config.sms.dedupTtlSeconds;

    // Check for existing dedup entry
    const existing = await this.kvService.get<{ seenAt: number }>(key);
    if (existing !== null) {
      this.logger.log(`SMS deduplicated: fingerprint=${fingerprint}`);
      return {
        accepted: false,
        deduped: true,
        fingerprint,
        message: 'duplicate',
      };
    }

    // Mark as seen immediately to prevent concurrent duplicates
    await this.kvService.set(key, { seenAt: Date.now() }, ttl);

    const job: SmsJob = {
      content: dto.content,
      sender: dto.sender,
      receivedAt: dto.receivedAt,
      device: dto.device,
      fingerprint,
    };

    // Fire background processing — never blocks the response
    void this.processInBackground(job);

    return { accepted: true, deduped: false, fingerprint };
  }

  async processInBackground(job: SmsJob): Promise<void> {
    // Schedule on the next event-loop tick to ensure the HTTP response is sent first
    await new Promise<void>((resolve) => setImmediate(resolve));

    try {
      const classified = await this.aiService.classifySms(job.content);
      this.logger.log(
        `SMS classified: kind=${classified.kind} confidence=${classified.confidence} fingerprint=${job.fingerprint}`,
      );

      const matchedHandlers = this.handlers.filter((h) =>
        h.canHandle(classified),
      );

      if (matchedHandlers.length === 0) {
        this.logger.log(
          `No handler matched for kind=${classified.kind}, fingerprint=${job.fingerprint}`,
        );
        return;
      }

      await Promise.all(
        matchedHandlers.map(async (h) => {
          try {
            await h.handle(job, classified);
          } catch (err) {
            this.logger.error(
              `Handler ${h.constructor?.name ?? 'unknown'} failed: ${String(err)}`,
            );
          }
        }),
      );
    } catch (err) {
      this.logger.error(
        `Background SMS processing failed for fingerprint=${job.fingerprint}: ${String(err)}`,
      );
    }
  }
}
