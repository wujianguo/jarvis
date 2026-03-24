import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../config/app-config.service';
import { WecomAuthService } from '../auth/wecom-auth.service';

export interface WecomApiResponse<T = unknown> {
  errcode: number;
  errmsg: string;
  data?: T;
}

@Injectable()
export class WecomHttpService {
  private readonly logger = new Logger(WecomHttpService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: WecomAuthService,
    private readonly config: AppConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.wecom.baseUrl ?? 'https://qyapi.weixin.qq.com';
  }

  private async buildParams(): Promise<Record<string, string>> {
    const token = await this.authService.getAccessToken();
    return { access_token: token };
  }

  private throwWecomError(errcode: number, errmsg: string): never {
    switch (errcode) {
      case 40014:
      case 42001:
        throw new UnauthorizedException(
          `WeCom: ${errmsg} (errcode=${errcode})`,
        );
      case 40003:
      case 40058:
        throw new BadRequestException(`WeCom: ${errmsg} (errcode=${errcode})`);
      case 48002:
        throw new ForbiddenException(`WeCom: ${errmsg} (errcode=${errcode})`);
      case 60111:
      case 60112:
        throw new NotFoundException(`WeCom: ${errmsg} (errcode=${errcode})`);
      case 45009:
        throw new HttpException(
          `WeCom: ${errmsg} (errcode=${errcode})`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      default:
        throw new InternalServerErrorException(
          `WeCom API error: ${errmsg} (errcode=${errcode})`,
        );
    }
  }

  async post<T>(
    path: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const params = await this.buildParams();
    const extraParams = config?.params as Record<string, string> | undefined;
    const response = await firstValueFrom(
      this.httpService.post<WecomApiResponse<T>>(
        `${this.baseUrl}${path}`,
        body,
        {
          ...config,
          params: { ...params, ...(extraParams ?? {}) },
          timeout: 10000,
        },
      ),
    );
    const { errcode, errmsg } = response.data;
    if (errcode !== 0) {
      this.throwWecomError(errcode, errmsg);
    }
    return response.data as T;
  }

  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const params = await this.buildParams();
    const extraParams = config?.params as Record<string, string> | undefined;
    const response = await firstValueFrom(
      this.httpService.get<WecomApiResponse<T>>(`${this.baseUrl}${path}`, {
        ...config,
        params: { ...params, ...(extraParams ?? {}) },
        timeout: 10000,
      }),
    );
    const { errcode, errmsg } = response.data;
    if (errcode !== 0) {
      this.throwWecomError(errcode, errmsg);
    }
    return response.data as T;
  }
}
