import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { AxiosError } from 'axios';

interface KvGetResponse {
  key: string;
  value: string;
  expire_at?: string;
  ttl_seconds_remaining?: number;
}

@Injectable()
export class KvService {
  private readonly logger = new Logger(KvService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: AppConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.kv.baseUrl;
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.kv.apiToken}` };
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<KvGetResponse>(
          `${this.baseUrl}/v1/kv/${encodeURIComponent(key)}`,
          { headers: this.headers },
        ),
      );
      const raw = response.data.value;
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        return null;
      }
      this.logger.warn(`KV get failed for key "${key}": ${String(err)}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const body: Record<string, unknown> = { value: JSON.stringify(value) };
      if (ttlSeconds !== undefined) {
        body.ttl_seconds = ttlSeconds;
      }
      await firstValueFrom(
        this.httpService.put(
          `${this.baseUrl}/v1/kv/${encodeURIComponent(key)}`,
          body,
          { headers: this.headers },
        ),
      );
    } catch (err) {
      this.logger.warn(`KV set failed for key "${key}": ${String(err)}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.baseUrl}/v1/kv/${encodeURIComponent(key)}`,
          { headers: this.headers },
        ),
      );
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        return;
      }
      this.logger.warn(`KV del failed for key "${key}": ${String(err)}`);
    }
  }
}
