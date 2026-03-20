import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import {
  FeishuBitableService,
  BitableRecord,
} from '../../integrations/feishu/bitable/feishu-bitable.service';
import {
  FeishuTaskService,
  TaskMember,
} from '../../integrations/feishu/task/feishu-task.service';
import { CreateExpressPickupDto } from './dto/create-express-pickup.dto';
import { UpdateExpressPickupDto } from './dto/update-express-pickup.dto';
import { ExpressPickupDto } from './dto/express-pickup.dto';
import { ExpressPickupStatus } from './express-pickup-status.enum';
import { toIso8601Beijing } from '../../common/time/beijing-time';

// Bitable column names for express_pickups (Chinese)
const COL_RAW_INFO = '原始信息';
const COL_ADDRESS = '取件地址';
const COL_PICKUP_CODE = '取件码';
const COL_TASK_ID = '任务ID';
const COL_STATUS = '状态';
const COL_CREATED_AT = '创建时间';
const COL_UPDATED_AT = '更新时间';

// Assignees table column names (unchanged)
const COL_USER_ID = 'user_id';
const COL_ENABLED = 'enabled';

/** Map a raw Bitable string value to the status enum, defaulting to Pending. */
function parseStatus(value: string): ExpressPickupStatus {
  return (Object.values(ExpressPickupStatus) as string[]).includes(value)
    ? (value as ExpressPickupStatus)
    : ExpressPickupStatus.Pending;
}

@Injectable()
export class ExpressPickupsService {
  private readonly logger = new Logger(ExpressPickupsService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly bitable: FeishuBitableService,
    private readonly taskService: FeishuTaskService,
  ) {}

  private get pickupsTableId(): string {
    const tableId =
      this.config.feishu.bitable.databases['home']?.tables?.['express_pickups']
        ?.tableId;
    if (!tableId) {
      throw new NotFoundException(
        'express_pickups table is not configured in FEISHU_BITABLE_DATABASES_JSON',
      );
    }
    return tableId;
  }

  private get assigneesTableId(): string {
    const tableId =
      this.config.feishu.bitable.databases['home']?.tables?.[
        'express_assignees'
      ]?.tableId;
    if (!tableId) {
      throw new NotFoundException(
        'express_assignees table is not configured in FEISHU_BITABLE_DATABASES_JSON',
      );
    }
    return tableId;
  }

  private recordToDto(record: BitableRecord): ExpressPickupDto {
    const f = record.fields;
    const toStr = (v: unknown): string => (typeof v === 'string' ? v : '');
    // Fall back to Date.now() for records created before the timestamp fields were added.
    const toMs = (v: unknown): number =>
      typeof v === 'number' ? v : Date.now();
    return {
      id: record.record_id,
      rawInfo: toStr(f[COL_RAW_INFO]),
      address: toStr(f[COL_ADDRESS]),
      pickupCode: toStr(f[COL_PICKUP_CODE]),
      taskId: typeof f[COL_TASK_ID] === 'string' ? f[COL_TASK_ID] : undefined,
      status: parseStatus(toStr(f[COL_STATUS])),
      createdAt: toIso8601Beijing(toMs(f[COL_CREATED_AT])),
      updatedAt: toIso8601Beijing(toMs(f[COL_UPDATED_AT])),
    };
  }

  private async getAssignees(): Promise<TaskMember[]> {
    try {
      const tableId = this.assigneesTableId;
      const result = await this.bitable.db('home').table(tableId).listRecords();
      const assignees: TaskMember[] = [];
      for (const record of result.items) {
        const userId = record.fields[COL_USER_ID];
        // If enabled column exists, only include enabled records
        if (COL_ENABLED in record.fields) {
          if (!record.fields[COL_ENABLED]) continue;
        }
        if (typeof userId === 'string' && userId) {
          assignees.push({ id: userId, type: 'user', role: 'assignee' });
        }
      }
      return assignees;
    } catch (err) {
      this.logger.warn(`Failed to fetch assignees: ${String(err)}`);
      return [];
    }
  }

  async create(dto: CreateExpressPickupDto): Promise<ExpressPickupDto> {
    const now = Date.now();
    // 1. Write to Bitable
    const record = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .createRecord({
        [COL_RAW_INFO]: dto.rawInfo,
        [COL_ADDRESS]: dto.address,
        [COL_PICKUP_CODE]: dto.pickupCode,
        [COL_STATUS]: ExpressPickupStatus.Pending,
        [COL_CREATED_AT]: now,
        [COL_UPDATED_AT]: now,
      });

    // 2. Get assignees
    const assignees = await this.getAssignees();

    // 3. Create Feishu task
    let taskId: string | undefined;
    try {
      taskId = await this.taskService.createTask({
        summary: `取件：${dto.address} - ${dto.pickupCode}`,
        description: dto.rawInfo,
        members: assignees,
      });

      // 4. Write task_id back to Bitable record
      await this.bitable
        .db('home')
        .table(this.pickupsTableId)
        .updateRecord(record.record_id, {
          [COL_TASK_ID]: taskId,
        });
    } catch (err) {
      this.logger.error(
        `Failed to create/link Feishu task for pickup ${record.record_id}: ${String(err)}`,
      );
    }

    return {
      id: record.record_id,
      rawInfo: dto.rawInfo,
      address: dto.address,
      pickupCode: dto.pickupCode,
      taskId,
      status: ExpressPickupStatus.Pending,
      createdAt: toIso8601Beijing(now),
      updatedAt: toIso8601Beijing(now),
    };
  }

  async update(
    id: string,
    dto: UpdateExpressPickupDto,
  ): Promise<ExpressPickupDto> {
    // Fetch existing record
    const existing = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .getRecord(id);

    const updatedFields: Record<string, unknown> = {};
    if (dto.rawInfo !== undefined) updatedFields[COL_RAW_INFO] = dto.rawInfo;
    if (dto.address !== undefined) updatedFields[COL_ADDRESS] = dto.address;
    if (dto.pickupCode !== undefined)
      updatedFields[COL_PICKUP_CODE] = dto.pickupCode;

    let updatedRecord = existing;
    if (Object.keys(updatedFields).length > 0) {
      updatedFields[COL_UPDATED_AT] = Date.now();
      updatedRecord = await this.bitable
        .db('home')
        .table(this.pickupsTableId)
        .updateRecord(id, updatedFields);
    }

    // Sync Feishu task if task_id exists
    const existingTaskId = existing.fields[COL_TASK_ID];
    const taskId =
      typeof existingTaskId === 'string' ? existingTaskId : undefined;
    if (taskId && Object.keys(updatedFields).length > 0) {
      try {
        const assignees = await this.getAssignees();
        const addrField = existing.fields[COL_ADDRESS];
        const codeField = existing.fields[COL_PICKUP_CODE];
        const infoField = existing.fields[COL_RAW_INFO];
        const mergedAddress =
          dto.address ?? (typeof addrField === 'string' ? addrField : '');
        const mergedPickupCode =
          dto.pickupCode ?? (typeof codeField === 'string' ? codeField : '');
        const mergedRawInfo =
          dto.rawInfo ?? (typeof infoField === 'string' ? infoField : '');
        await this.taskService.updateTask(taskId, {
          summary: `取件：${mergedAddress} - ${mergedPickupCode}`,
          description: mergedRawInfo,
          members: assignees,
        });
      } catch (err) {
        this.logger.error(
          `Failed to update Feishu task ${taskId}: ${String(err)}`,
        );
      }
    }

    return this.recordToDto(updatedRecord);
  }

  async findAll(
    status: ExpressPickupStatus = ExpressPickupStatus.Pending,
  ): Promise<ExpressPickupDto[]> {
    const result = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .listRecords({
        filter: `CurrentValue.[${COL_STATUS}] = "${status}"`,
      });
    return result.items.map((r) => this.recordToDto(r));
  }

  async findOne(id: string): Promise<ExpressPickupDto> {
    const record = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .getRecord(id);
    return this.recordToDto(record);
  }

  /**
   * Mark a pickup record as done by its record id.
   * Idempotent: if the record is already Done the status update is still
   * written (no-op in Bitable) and task completion is still attempted.
   * If the record has a 任务ID the Feishu task is completed via updateTask.
   */
  async markDone(id: string): Promise<ExpressPickupDto> {
    // Fetch existing record – throws NotFoundException if absent.
    const existing = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .getRecord(id);

    const now = Date.now();
    const updatedRecord = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .updateRecord(id, {
        [COL_STATUS]: ExpressPickupStatus.Done,
        [COL_UPDATED_AT]: now,
      });

    // Complete the linked Feishu task if a taskId is present.
    const rawTaskId = existing.fields[COL_TASK_ID];
    const taskId = typeof rawTaskId === 'string' ? rawTaskId : undefined;
    if (taskId) {
      try {
        await this.taskService.updateTask(taskId, {
          completed_at: String(now),
        });
      } catch (err) {
        this.logger.error(
          `Failed to complete Feishu task ${taskId} for pickup ${id}: ${String(err)}`,
        );
      }
    }

    return this.recordToDto(updatedRecord);
  }

  /**
   * Mark a pickup record as done by pickup code.
   * Searches for pending records (状态=未取件) whose 取件码 matches the
   * given code.  When multiple pending records match the "latest" one is
   * chosen: the record with the greatest 更新时间; falling back to 创建时间,
   * then to deterministic record_id order.
   * Returns 404 when no pending record matches the pickup code.
   */
  async markDoneByCode(pickupCode: string): Promise<ExpressPickupDto> {
    const result = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .listRecords({
        filter:
          `CurrentValue.[${COL_PICKUP_CODE}] = "${pickupCode}" && ` +
          `CurrentValue.[${COL_STATUS}] = "${ExpressPickupStatus.Pending}"`,
      });

    if (result.items.length === 0) {
      throw new NotFoundException(
        `No pending express pickup found for pickupCode="${pickupCode}"`,
      );
    }

    // Pick the "latest" record among all pending matches.
    // Prefer 更新时间; fall back to 创建时间; then treat as 0 (oldest).
    const recordTimestampMs = (record: BitableRecord): number => {
      const upd = record.fields[COL_UPDATED_AT];
      if (typeof upd === 'number') return upd;
      const cre = record.fields[COL_CREATED_AT];
      if (typeof cre === 'number') return cre;
      return 0;
    };

    const withTs = result.items.map((r) => ({
      record: r,
      ts: recordTimestampMs(r),
    }));
    const latest = withTs.reduce((best, cur) =>
      cur.ts > best.ts ? cur : best,
    ).record;

    return this.markDone(latest.record_id);
  }
}
