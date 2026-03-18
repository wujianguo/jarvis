import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BitableDatabaseConfig {
  appToken: string;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 9000);
  }

  get kv() {
    return {
      baseUrl: this.configService.getOrThrow<string>('KV_BASE_URL'),
      apiToken: this.configService.getOrThrow<string>('KV_API_TOKEN'),
    };
  }

  get feishu() {
    const databasesJson = this.configService.get<string>(
      'FEISHU_BITABLE_DATABASES_JSON',
      '{}',
    );
    let databases: Record<string, BitableDatabaseConfig> = {};
    try {
      databases = JSON.parse(databasesJson) as Record<
        string,
        BitableDatabaseConfig
      >;
    } catch {
      databases = {};
    }

    return {
      baseUrl: this.configService.get<string>(
        'FEISHU_BASE_URL',
        'https://open.feishu.cn',
      ),
      appId: this.configService.getOrThrow<string>('FEISHU_APP_ID'),
      appSecret: this.configService.getOrThrow<string>('FEISHU_APP_SECRET'),
      webhookPath: this.configService.get<string>(
        'FEISHU_WEBHOOK_PATH',
        '/feishu/webhook',
      ),
      verificationToken: this.configService.getOrThrow<string>(
        'FEISHU_VERIFICATION_TOKEN',
      ),
      bitable: { databases },
      sheets: {
        exportSpreadsheetToken: this.configService.get<string>(
          'FEISHU_SHEETS_EXPORT_SPREADSHEET_TOKEN',
        ),
        exportSheetId: this.configService.get<string>(
          'FEISHU_SHEETS_EXPORT_SHEET_ID',
        ),
      },
    };
  }
}
