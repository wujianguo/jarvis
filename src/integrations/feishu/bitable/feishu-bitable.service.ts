import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { FeishuHttpService } from '../http/feishu-http.service';

export interface BitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

export interface ListRecordsOptions {
  filter?: string;
  page_token?: string;
  page_size?: number;
  sort?: string;
}

export interface ListRecordsResult {
  items: BitableRecord[];
  page_token?: string;
  has_more: boolean;
  total: number;
}

interface ListRecordsResponse {
  items: BitableRecord[];
  page_token?: string;
  has_more: boolean;
  total: number;
}

interface GetRecordResponse {
  record: BitableRecord;
}

interface CreateRecordResponse {
  record: BitableRecord;
}

interface BatchCreateRecordsResponse {
  records: BitableRecord[];
}

interface UpdateRecordResponse {
  record: BitableRecord;
}

interface DeleteRecordResponse {
  deleted: boolean;
  record_id: string;
}

class BitableTableAccessor {
  constructor(
    private readonly appToken: string,
    private readonly tableId: string,
    private readonly http: FeishuHttpService,
  ) {}

  private get basePath(): string {
    return `/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records`;
  }

  async listRecords(
    options: ListRecordsOptions = {},
  ): Promise<ListRecordsResult> {
    const params: Record<string, string | number> = {};
    if (options.filter) params.filter = options.filter;
    if (options.page_token) params.page_token = options.page_token;
    if (options.page_size) params.page_size = options.page_size;
    if (options.sort) params.sort = options.sort;

    const response = await this.http.get<ListRecordsResponse>(this.basePath, {
      params,
    });
    const data = response.data.data!;
    return {
      items: data.items ?? [],
      page_token: data.page_token,
      has_more: data.has_more ?? false,
      total: data.total ?? 0,
    };
  }

  async getRecord(recordId: string): Promise<BitableRecord> {
    const response = await this.http.get<GetRecordResponse>(
      `${this.basePath}/${recordId}`,
    );
    const record = response.data.data?.record;
    if (!record) {
      throw new NotFoundException(`Record ${recordId} not found`);
    }
    return record;
  }

  async createRecord(fields: Record<string, unknown>): Promise<BitableRecord> {
    const response = await this.http.post<CreateRecordResponse>(this.basePath, {
      fields,
    });
    return response.data.data!.record;
  }

  async batchCreateRecords(
    records: Record<string, unknown>[],
  ): Promise<BitableRecord[]> {
    const response = await this.http.post<BatchCreateRecordsResponse>(
      `${this.basePath}/batch_create`,
      { records: records.map((fields) => ({ fields })) },
    );
    return response.data.data!.records;
  }

  async updateRecord(
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<BitableRecord> {
    const response = await this.http.put<UpdateRecordResponse>(
      `${this.basePath}/${recordId}`,
      { fields },
    );
    return response.data.data!.record;
  }

  async deleteRecord(recordId: string): Promise<boolean> {
    const response = await this.http.delete<DeleteRecordResponse>(
      `${this.basePath}/${recordId}`,
    );
    return response.data.data?.deleted ?? false;
  }
}

class BitableDbAccessor {
  constructor(
    private readonly appToken: string,
    private readonly http: FeishuHttpService,
  ) {}

  table(tableId: string): BitableTableAccessor {
    return new BitableTableAccessor(this.appToken, tableId, this.http);
  }
}

@Injectable()
export class FeishuBitableService {
  constructor(
    private readonly config: AppConfigService,
    private readonly http: FeishuHttpService,
  ) {}

  db(name: string): BitableDbAccessor {
    const databases = this.config.feishu.bitable.databases;
    const dbConfig = databases[name];
    if (!dbConfig) {
      throw new NotFoundException(
        `Bitable database "${name}" is not configured`,
      );
    }
    return new BitableDbAccessor(dbConfig.appToken, this.http);
  }

  dbByToken(appToken: string): BitableDbAccessor {
    return new BitableDbAccessor(appToken, this.http);
  }
}
