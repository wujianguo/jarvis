import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../config/app-config.service';
import { KvService } from '../../kv/kv.service';

interface TenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

@Injectable()
export class FeishuAuthService {
  private readonly logger = new Logger(FeishuAuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: AppConfigService,
    private readonly kvService: KvService,
  ) {}

  private get cacheKey(): string {
    return `feishu:tenant_access_token:${this.config.feishu.appId}`;
  }

  async getTenantAccessToken(): Promise<string> {
    const cached = await this.kvService.get<string>(this.cacheKey);
    if (cached) {
      return cached;
    }

    const { baseUrl, appId, appSecret } = this.config.feishu;
    const response = await firstValueFrom(
      this.httpService.post<TenantAccessTokenResponse>(
        `${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`,
        { app_id: appId, app_secret: appSecret },
      ),
    );

    const { code, tenant_access_token, expire } = response.data;
    if (code !== 0) {
      throw new Error(
        `Feishu auth failed: ${response.data.msg} (code=${code})`,
      );
    }

    const ttl = Math.max(expire - 60, 60);
    await this.kvService.set(this.cacheKey, tenant_access_token, ttl);
    this.logger.debug(`Fetched new tenant_access_token, TTL=${ttl}s`);

    return tenant_access_token;
  }
}
