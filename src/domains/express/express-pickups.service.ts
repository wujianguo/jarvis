import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import {
  FeishuBitableService,
  BitableRecord,
} from '../../integrations/feishu/bitable/feishu-bitable.service';
import {
  FeishuTaskService,
  TaskAssignee,
} from '../../integrations/feishu/task/feishu-task.service';
import { CreateExpressPickupDto } from './dto/create-express-pickup.dto';
import { UpdateExpressPickupDto } from './dto/update-express-pickup.dto';
import { ExpressPickupDto } from './dto/express-pickup.dto';

// Bitable column names (hardcoded)
const COL_RAW_INFO = 'raw_info';
const COL_ADDRESS = 'address';
const COL_PICKUP_CODE = 'pickup_code';
const COL_TASK_ID = 'task_id';
const COL_STATUS = 'status';

// Assignees table column names (hardcoded)
const COL_USER_ID = 'user_id';
const COL_ENABLED = 'enabled';

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
    return {
      id: record.record_id,
      rawInfo: toStr(f[COL_RAW_INFO]),
      address: toStr(f[COL_ADDRESS]),
      pickupCode: toStr(f[COL_PICKUP_CODE]),
      taskId: typeof f[COL_TASK_ID] === 'string' ? f[COL_TASK_ID] : undefined,
      status: toStr(f[COL_STATUS]) || 'pending',
    };
  }

  private async getAssignees(): Promise<TaskAssignee[]> {
    try {
      const tableId = this.assigneesTableId;
      const result = await this.bitable.db('home').table(tableId).listRecords();
      const assignees: TaskAssignee[] = [];
      for (const record of result.items) {
        const userId = record.fields[COL_USER_ID];
        // If enabled column exists, only include enabled records
        if (COL_ENABLED in record.fields) {
          if (!record.fields[COL_ENABLED]) continue;
        }
        if (typeof userId === 'string' && userId) {
          assignees.push({ id: userId, type: 'user' });
        }
      }
      return assignees;
    } catch (err) {
      this.logger.warn(`Failed to fetch assignees: ${String(err)}`);
      return [];
    }
  }

  async create(dto: CreateExpressPickupDto): Promise<ExpressPickupDto> {
    // 1. Write to Bitable
    const record = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .createRecord({
        [COL_RAW_INFO]: dto.rawInfo,
        [COL_ADDRESS]: dto.address,
        [COL_PICKUP_CODE]: dto.pickupCode,
        [COL_STATUS]: 'pending',
      });

    // 2. Get assignees
    const assignees = await this.getAssignees();

    // 3. Create Feishu task
    let taskId: string | undefined;
    try {
      taskId = await this.taskService.createTask({
        summary: `取件：${dto.address} - ${dto.pickupCode}`,
        description: dto.rawInfo,
        assignee_ids: assignees,
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
      status: 'pending',
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
          assignee_ids: assignees,
        });
      } catch (err) {
        this.logger.error(
          `Failed to update Feishu task ${taskId}: ${String(err)}`,
        );
      }
    }

    return this.recordToDto(updatedRecord);
  }

  async findAll(): Promise<ExpressPickupDto[]> {
    const result = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .listRecords();
    return result.items.map((r) => this.recordToDto(r));
  }

  async findOne(id: string): Promise<ExpressPickupDto> {
    const record = await this.bitable
      .db('home')
      .table(this.pickupsTableId)
      .getRecord(id);
    return this.recordToDto(record);
  }
}
