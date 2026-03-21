import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SmsIngestService } from './sms-ingest.service';
import { IngestSmsDto } from './dto/ingest-sms.dto';
import { SmsIngestResponseDto } from './dto/sms-ingest-response.dto';

/**
 * ⚠️ Security Notice: This endpoint is currently unauthenticated.
 * Anyone who knows the URL can POST SMS data to it.
 * Before exposing to the public internet, add a bearer-token guard or
 * IP allowlist. A placeholder `Authorization` header check can be added
 * by enabling the `SmsAuthGuard` (not yet implemented).
 */
@ApiTags('sms')
@Controller('sms')
export class SmsIngestController {
  constructor(private readonly smsIngestService: SmsIngestService) {}

  @Post('ingest')
  @HttpCode(202)
  @ApiOperation({
    summary: '接收短信并异步处理',
    description: [
      '接受 iOS 捷径自动化 POST 过来的短信内容，立即返回（202 Accepted）。',
      '后台异步执行 AI 分类并按分类结果分发到对应处理器（如快递取件）。',
      '',
      '**幂等去重**：同一短信在 `SMS_DEDUP_TTL_SECONDS`（默认 120 秒）内的重复请求',
      '会被去重，返回 `deduped: true`，不会触发重复处理。',
      '',
      '**⚠️ 安全提示**：本接口当前无鉴权，请勿在未做访问控制的情况下公开暴露。',
    ].join('\n'),
  })
  @ApiResponse({
    status: 202,
    type: SmsIngestResponseDto,
    description: '请求已受理（可能已去重）',
  })
  @ApiResponse({ status: 400, description: '请求参数校验失败' })
  async ingest(@Body() dto: IngestSmsDto): Promise<SmsIngestResponseDto> {
    return this.smsIngestService.ingest(dto);
  }
}
