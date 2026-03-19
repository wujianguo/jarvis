import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  FeishuEventHandler,
  FeishuEventDispatcher,
} from '../webhook/feishu-event.dispatcher';
import { FeishuBitableService } from '../bitable/feishu-bitable.service';
import { AppConfigService } from '../../../config/app-config.service';

interface TaskUpdateEvent {
  task?: {
    guid?: string;
    completed_at?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

@Injectable()
export class FeishuTaskEventHandler
  implements FeishuEventHandler, OnModuleInit
{
  readonly eventType = 'task.task.update_tenant_v1';
  private readonly logger = new Logger(FeishuTaskEventHandler.name);

  constructor(
    private readonly dispatcher: FeishuEventDispatcher,
    private readonly bitable: FeishuBitableService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.register(this);
  }

  async handle(event: Record<string, unknown>): Promise<void> {
    const taskEvent = event as TaskUpdateEvent;
    const task = taskEvent.task;
    if (!task?.guid) {
      this.logger.warn('Received task update event without task guid');
      return;
    }

    const taskGuid = task.guid;
    const completedAt = task.completed_at;

    // Only process when task is completed (completed_at is set and non-empty)
    if (!completedAt) {
      this.logger.debug(`Task ${taskGuid} updated but not completed, skipping`);
      return;
    }

    const databases = this.config.feishu.bitable.databases;
    const homeDb = databases['home'];
    if (!homeDb?.tables?.['express_pickups']?.tableId) {
      this.logger.warn(
        'express_pickups table not configured, skipping task complete callback',
      );
      return;
    }

    const tableId = homeDb.tables['express_pickups'].tableId;

    try {
      // Search for the pickup record with this task_id
      const result = await this.bitable
        .db('home')
        .table(tableId)
        .listRecords({ filter: `CurrentValue.[task_id] = "${taskGuid}"` });

      if (result.items.length === 0) {
        this.logger.warn(`No express pickup found for task_id=${taskGuid}`);
        return;
      }

      const record = result.items[0];
      await this.bitable
        .db('home')
        .table(tableId)
        .updateRecord(record.record_id, {
          status: 'done',
        });

      this.logger.log(
        `Updated express pickup ${record.record_id} to status=done (task_id=${taskGuid})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to update express pickup for task_id=${taskGuid}: ${String(err)}`,
      );
    }
  }
}
