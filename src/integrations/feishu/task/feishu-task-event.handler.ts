import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  FeishuEventHandler,
  FeishuEventDispatcher,
} from '../webhook/feishu-event.dispatcher';
import { FeishuBitableService } from '../bitable/feishu-bitable.service';
import { AppConfigService } from '../../../config/app-config.service';
import { ExpressPickupStatus } from '../../../domains/express/express-pickup-status.enum';
import { FeishuTaskService } from './feishu-task.service';

interface TaskUpdateTenantV1Event {
  task_id?: string;
  object_type?: string;
  event_type?: string;
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
    private readonly taskService: FeishuTaskService,
  ) {}

  onModuleInit(): void {
    this.dispatcher.register(this);
  }

  async handle(
    event: Record<string, unknown>,
    header?: Record<string, unknown>,
  ): Promise<void> {
    const e = event as TaskUpdateTenantV1Event;
    const taskGuid = e.task_id;
    const eventId =
      typeof header?.['event_id'] === 'string' ? header['event_id'] : '';

    if (!taskGuid) {
      this.logger.warn(
        `Received task update event without task_id (event_id=${eventId})`,
      );
      return;
    }

    // Query Feishu Task v2 API for task details to determine completion status.
    let completedAt: string | undefined;
    try {
      const task = await this.taskService.getTask(taskGuid);
      completedAt =
        typeof task.completed_at === 'string' ? task.completed_at : undefined;
    } catch (err) {
      this.logger.error(
        `Failed to fetch Feishu task detail for task_id=${taskGuid} (event_id=${eventId}): ${String(err)}`,
      );
      return;
    }

    // Only proceed when the task has been marked as completed.
    if (!completedAt) {
      this.logger.debug(
        `Task ${taskGuid} updated but not completed (completed_at empty), skipping (event_id=${eventId})`,
      );
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
      const result = await this.bitable
        .db('home')
        .table(tableId)
        .listRecords({ filter: `CurrentValue.[任务ID] = "${taskGuid}"` });

      if (result.items.length === 0) {
        this.logger.warn(`No express pickup found for 任务ID=${taskGuid}`);
        return;
      }

      const record = result.items[0];
      await this.bitable
        .db('home')
        .table(tableId)
        .updateRecord(record.record_id, {
          状态: ExpressPickupStatus.Done,
          更新时间: Date.now(),
        });

      this.logger.log(
        `Updated express pickup ${record.record_id} to 状态=已取件 (任务ID=${taskGuid})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to update express pickup for 任务ID=${taskGuid}: ${String(err)}`,
      );
    }
  }
}
