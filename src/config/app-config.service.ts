import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BitableTableConfig {
  tableId: string;
}

export interface BitableDatabaseConfig {
  appToken: string;
  tables?: Record<string, BitableTableConfig>;
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

  get ai() {
    return {
      cloudflareAccountId: this.configService.getOrThrow<string>(
        'CLOUDFLARE_ACCOUNT_ID',
      ),
      gatewayName: this.configService.getOrThrow<string>('GATEWAY_NAME'),
      cfAigToken: this.configService.getOrThrow<string>('CF_AIG_TOKEN'),
    };
  }

  get sms() {
    return {
      dedupTtlSeconds: this.configService.get<number>(
        'SMS_DEDUP_TTL_SECONDS',
        120,
      ),
    };
  }

  get wecom() {
    return {
      baseUrl: this.configService.get<string>(
        'WECOM_BASE_URL',
        'https://qyapi.weixin.qq.com',
      ),
      corpId: this.configService.get<string>('WECOM_CORP_ID'),
      corpSecret: this.configService.get<string>('WECOM_CORP_SECRET'),
      agentId: this.configService.get<number>('WECOM_AGENT_ID'),
      token: this.configService.get<string>('WECOM_TOKEN'),
      encodingAESKey: this.configService.get<string>('WECOM_ENCODING_AES_KEY'),
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
        '/api/feishu/webhook',
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
