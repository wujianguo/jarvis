import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WecomMessageService } from '../../integrations/wecom/message/wecom-message.service';
import {
  SendTextMessageDto,
  SendMessageResponseDto,
} from './dto/wecom-message.dto';

/**
 * ⚠️ Security Notice: This endpoint is currently unauthenticated.
 * Anyone who knows the URL can POST requests to trigger WeCom messages.
 * Before exposing to the public internet, add a bearer-token guard or
 * IP allowlist. A placeholder `Authorization` header check can be added
 * by enabling a WeCom auth guard (not yet implemented).
 */
@ApiTags('wecom')
@Controller('wecom/messages')
export class WecomMessagesController {
  constructor(private readonly messageService: WecomMessageService) {}

  @Post('text')
  @HttpCode(200)
  @ApiOperation({
    summary: '通过企业微信发送文本消息',
    description: [
      '调用企业微信自建应用接口发送文本消息，至少指定 toUser / toParty / toTag 之一；',
      '若均未指定，则默认发送给所有成员（@all）。',
      '',
      '**⚠️ 安全提示**：本接口当前无鉴权，请勿在未做访问控制的情况下公开暴露。',
    ].join('\n'),
  })
  @ApiResponse({
    status: 200,
    type: SendMessageResponseDto,
    description: '企业微信接口返回结果（errcode=0 表示成功）',
  })
  @ApiResponse({ status: 400, description: '请求参数校验失败' })
  async sendText(
    @Body() dto: SendTextMessageDto,
  ): Promise<SendMessageResponseDto> {
    return this.messageService.sendText(dto);
  }
}
