import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../config/app-config.service';
import { KvService } from '../../kv/kv.service';

interface AccessTokenResponse {
  errcode?: number;
  errmsg?: string;
  access_token: string;
  expires_in: number;
}

@Injectable()
export class WecomAuthService {
  private readonly logger = new Logger(WecomAuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: AppConfigService,
    private readonly kvService: KvService,
  ) {}

  private get cacheKey(): string {
    return `wecom:access_token:${this.config.wecom.corpId ?? 'default'}`;
  }

  async getAccessToken(): Promise<string> {
    const cached = await this.kvService.get<string>(this.cacheKey);
    if (cached) {
      return cached;
    }

    const {
      baseUrl = 'https://qyapi.weixin.qq.com',
      corpId,
      corpSecret,
    } = this.config.wecom;
    if (!corpId || !corpSecret) {
      throw new Error(
        'WeCom corpId and corpSecret are required (WECOM_CORP_ID, WECOM_CORP_SECRET)',
      );
    }

    const response = await firstValueFrom(
      this.httpService.get<AccessTokenResponse>(`${baseUrl}/cgi-bin/gettoken`, {
        params: { corpid: corpId, corpsecret: corpSecret },
      }),
    );

    const { errcode, errmsg, access_token, expires_in } = response.data;
    if (errcode && errcode !== 0) {
      throw new Error(
        `WeCom gettoken failed: ${errmsg ?? 'unknown'} (errcode=${errcode})`,
      );
    }

    // Cache with a TTL slightly less than expires_in to avoid using an expired token
    const ttl = Math.max(expires_in - 60, 60);
    await this.kvService.set(this.cacheKey, access_token, ttl);
    this.logger.debug(`Fetched new WeCom access_token, TTL=${ttl}s`);

    return access_token;
  }
}
