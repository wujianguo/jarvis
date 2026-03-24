import { Injectable, Logger } from '@nestjs/common';

export interface WecomEventHandler {
  eventType: string | string[];
  handle(event: Record<string, unknown>): Promise<void> | void;
}

export const WECOM_EVENT_HANDLER = 'WECOM_EVENT_HANDLER';

@Injectable()
export class WecomEventDispatcher {
  private readonly logger = new Logger(WecomEventDispatcher.name);
  private readonly handlers: WecomEventHandler[] = [];

  register(handler: WecomEventHandler): void {
    this.handlers.push(handler);
  }

  async dispatch(
    eventType: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    const matched = this.handlers.filter((h) => {
      const types = Array.isArray(h.eventType) ? h.eventType : [h.eventType];
      return types.includes(eventType) || types.includes('*');
    });

    if (matched.length === 0) {
      this.logger.debug(
        `No WeCom handler registered for event type: ${eventType}`,
      );
      return;
    }

    await Promise.all(
      matched.map(async (h) => {
        try {
          await h.handle(event);
        } catch (err) {
          this.logger.error(
            `Handler ${h.constructor?.name} failed for WeCom event ${eventType}: ${String(err)}`,
          );
        }
      }),
    );
  }
}
