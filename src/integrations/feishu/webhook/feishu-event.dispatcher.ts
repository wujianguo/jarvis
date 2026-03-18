import { Injectable, Logger } from '@nestjs/common';

export interface FeishuEventHandler {
  eventType: string | string[];
  handle(
    event: Record<string, unknown>,
    header?: Record<string, unknown>,
  ): Promise<void> | void;
}

export const FEISHU_EVENT_HANDLER = 'FEISHU_EVENT_HANDLER';

@Injectable()
export class FeishuEventDispatcher {
  private readonly logger = new Logger(FeishuEventDispatcher.name);
  private readonly handlers: FeishuEventHandler[] = [];

  register(handler: FeishuEventHandler): void {
    this.handlers.push(handler);
  }

  async dispatch(
    eventType: string,
    event: Record<string, unknown>,
    header?: Record<string, unknown>,
  ): Promise<void> {
    const matched = this.handlers.filter((h) => {
      const types = Array.isArray(h.eventType) ? h.eventType : [h.eventType];
      return types.includes(eventType) || types.includes('*');
    });

    if (matched.length === 0) {
      this.logger.debug(`No handler registered for event type: ${eventType}`);
      return;
    }

    await Promise.all(
      matched.map(async (h) => {
        try {
          await h.handle(event, header);
        } catch (err) {
          this.logger.error(
            `Handler ${h.constructor?.name} failed for event ${eventType}: ${String(err)}`,
          );
        }
      }),
    );
  }
}
