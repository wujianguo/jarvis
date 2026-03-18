import { Injectable } from '@nestjs/common';
import {
  FeishuBitableService,
  ListRecordsOptions,
  ListRecordsResult,
  BitableRecord,
} from '../bitable/feishu-bitable.service';
import { FeishuSheetsService } from '../sheets/feishu-sheets.service';

class StorageTableAccessor {
  constructor(
    private readonly dbName: string,
    private readonly tableId: string,
    private readonly bitable: FeishuBitableService,
  ) {}

  list(options?: ListRecordsOptions): Promise<ListRecordsResult> {
    return this.bitable
      .db(this.dbName)
      .table(this.tableId)
      .listRecords(options);
  }

  get(recordId: string): Promise<BitableRecord> {
    return this.bitable.db(this.dbName).table(this.tableId).getRecord(recordId);
  }

  create(fields: Record<string, unknown>): Promise<BitableRecord> {
    return this.bitable
      .db(this.dbName)
      .table(this.tableId)
      .createRecord(fields);
  }

  batchCreate(records: Record<string, unknown>[]): Promise<BitableRecord[]> {
    return this.bitable
      .db(this.dbName)
      .table(this.tableId)
      .batchCreateRecords(records);
  }

  update(
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<BitableRecord> {
    return this.bitable
      .db(this.dbName)
      .table(this.tableId)
      .updateRecord(recordId, fields);
  }

  delete(recordId: string): Promise<boolean> {
    return this.bitable
      .db(this.dbName)
      .table(this.tableId)
      .deleteRecord(recordId);
  }
}

class StorageDbAccessor {
  constructor(
    private readonly dbName: string,
    private readonly bitable: FeishuBitableService,
  ) {}

  table(tableId: string): StorageTableAccessor {
    return new StorageTableAccessor(this.dbName, tableId, this.bitable);
  }
}

class StorageExportAccessor {
  constructor(private readonly sheets: FeishuSheetsService) {}

  append(rows: unknown[][]): Promise<void> {
    return this.sheets.appendExportRows(rows);
  }

  appendTo(
    spreadsheetToken: string,
    sheetId: string,
    rows: unknown[][],
  ): ReturnType<FeishuSheetsService['appendRows']> {
    return this.sheets.appendRows(spreadsheetToken, sheetId, rows);
  }
}

@Injectable()
export class FeishuStorageService {
  readonly exportLog: StorageExportAccessor;

  constructor(
    private readonly bitable: FeishuBitableService,
    private readonly sheets: FeishuSheetsService,
  ) {
    this.exportLog = new StorageExportAccessor(sheets);
  }

  db(name: string): StorageDbAccessor {
    return new StorageDbAccessor(name, this.bitable);
  }
}
