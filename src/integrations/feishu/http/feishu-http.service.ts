import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { FeishuAuthService } from '../auth/feishu-auth.service';
import { AppConfigService } from '../../../config/app-config.service';

interface FeishuApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

@Injectable()
export class FeishuHttpService {
  private readonly logger = new Logger(FeishuHttpService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: FeishuAuthService,
    private readonly config: AppConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.feishu.baseUrl;
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const token = await this.authService.getTenantAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    };
  }

  private throwFeishuError(code: number, msg: string): never {
    switch (code) {
      case 99991663:
      case 99991664:
        throw new UnauthorizedException(`Feishu: ${msg} (code=${code})`);
      case 99991400:
        throw new BadRequestException(`Feishu: ${msg} (code=${code})`);
      case 99991401:
        throw new ForbiddenException(`Feishu: ${msg} (code=${code})`);
      case 99991404:
        throw new NotFoundException(`Feishu: ${msg} (code=${code})`);
      case 99991429:
        throw new HttpException(
          `Feishu: ${msg} (code=${code})`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      default:
        throw new InternalServerErrorException(
          `Feishu API error: ${msg} (code=${code})`,
        );
    }
  }

  async get<T>(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<FeishuApiResponse<T>>> {
    const headers = await this.buildHeaders();
    const response = await firstValueFrom(
      this.httpService.get<FeishuApiResponse<T>>(`${this.baseUrl}${path}`, {
        ...config,
        headers: { ...headers, ...(config?.headers ?? {}) },
        timeout: 10000,
      }),
    );
    if (response.data.code !== 0) {
      this.throwFeishuError(response.data.code, response.data.msg);
    }
    return response;
  }

  async post<T>(
    path: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<FeishuApiResponse<T>>> {
    const headers = await this.buildHeaders();
    const response = await firstValueFrom(
      this.httpService.post<FeishuApiResponse<T>>(
        `${this.baseUrl}${path}`,
        body,
        {
          ...config,
          headers: { ...headers, ...(config?.headers ?? {}) },
          timeout: 10000,
        },
      ),
    );
    if (response.data.code !== 0) {
      this.throwFeishuError(response.data.code, response.data.msg);
    }
    return response;
  }

  async put<T>(
    path: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<FeishuApiResponse<T>>> {
    const headers = await this.buildHeaders();
    const response = await firstValueFrom(
      this.httpService.put<FeishuApiResponse<T>>(
        `${this.baseUrl}${path}`,
        body,
        {
          ...config,
          headers: { ...headers, ...(config?.headers ?? {}) },
          timeout: 10000,
        },
      ),
    );
    if (response.data.code !== 0) {
      this.throwFeishuError(response.data.code, response.data.msg);
    }
    return response;
  }

  async delete<T>(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<FeishuApiResponse<T>>> {
    const headers = await this.buildHeaders();
    const response = await firstValueFrom(
      this.httpService.delete<FeishuApiResponse<T>>(`${this.baseUrl}${path}`, {
        ...config,
        headers: { ...headers, ...(config?.headers ?? {}) },
        timeout: 10000,
      }),
    );
    if (response.data.code !== 0) {
      this.throwFeishuError(response.data.code, response.data.msg);
    }
    return response;
  }
}
