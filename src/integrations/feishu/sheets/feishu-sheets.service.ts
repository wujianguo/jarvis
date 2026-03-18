import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { FeishuHttpService } from '../http/feishu-http.service';

interface AppendRowsResponse {
  tableRange: string;
  revision: number;
  updates: {
    spreadsheetToken: string;
    tableRange: string;
    revision: number;
    updatedRange: string;
    updatedRows: number;
    updatedColumns: number;
    updatedCells: number;
  };
}

@Injectable()
export class FeishuSheetsService {
  private readonly logger = new Logger(FeishuSheetsService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly http: FeishuHttpService,
  ) {}

  async appendRows(
    spreadsheetToken: string,
    sheetId: string,
    rows: unknown[][],
    valueRange?: string,
  ): Promise<AppendRowsResponse> {
    const range = valueRange ?? `${sheetId}!A1`;
    const response = await this.http.post<AppendRowsResponse>(
      `/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_append`,
      {
        valueRange: {
          range,
          values: rows,
        },
      },
    );
    this.logger.debug(
      `Appended ${rows.length} row(s) to ${spreadsheetToken}/${sheetId}`,
    );
    return response.data.data!;
  }

  async appendExportRows(rows: unknown[][]): Promise<void> {
    const { exportSpreadsheetToken, exportSheetId } = this.config.feishu.sheets;
    if (!exportSpreadsheetToken || !exportSheetId) {
      this.logger.warn(
        'Sheets export is not configured (missing FEISHU_SHEETS_EXPORT_SPREADSHEET_TOKEN or FEISHU_SHEETS_EXPORT_SHEET_ID)',
      );
      return;
    }
    await this.appendRows(exportSpreadsheetToken, exportSheetId, rows);
  }
}
