import {
  Body,
  Controller,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from '../../../config/app-config.service';
import { FeishuEventDispatcher } from './feishu-event.dispatcher';
import {
  FeishuChallengeResponseDto,
  FeishuWebhookDto,
} from './feishu-webhook.dto';

@ApiTags('feishu')
@Controller('feishu/webhook')
export class FeishuWebhookController {
  private readonly logger = new Logger(FeishuWebhookController.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly dispatcher: FeishuEventDispatcher,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Feishu event callback',
    description:
      'Receives Feishu Open Platform event callbacks (plaintext, no encryption). ' +
      'Handles challenge verification and dispatches events.',
  })
  @ApiResponse({
    status: 200,
    type: FeishuChallengeResponseDto,
    description: 'Challenge response or empty object for events',
  })
  @ApiResponse({ status: 401, description: 'Invalid verification token' })
  handleWebhook(
    @Body() body: FeishuWebhookDto,
  ): FeishuChallengeResponseDto | Record<string, never> {
    // 1) Challenge handshake (URL verification)
    if (body.type === 'url_verification' && body.challenge) {
      const token = body.token;
      this.validateToken(token);
      return { challenge: body.challenge };
    }

    // 2) Schema 2.0 events (header.token)
    const headerToken = body.header?.token;
    const eventType = body.header?.event_type;

    if (eventType) {
      this.validateToken(headerToken);
      this.logger.debug(`Received Feishu event: ${eventType}`);
      void this.dispatcher.dispatch(
        eventType,
        body.event ?? {},
        body.header as Record<string, unknown>,
      );
      return {};
    }

    // 3) Legacy / unknown structure — validate token if present
    this.validateToken(body.token ?? headerToken);
    return {};
  }

  private validateToken(token: string | undefined): void {
    const expected = this.config.feishu.verificationToken;
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid Feishu verification token');
    }
  }
}
