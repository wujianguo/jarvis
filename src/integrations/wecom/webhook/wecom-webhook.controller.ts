import {
  Controller,
  Get,
  Post,
  Query,
  RawBody,
  Logger,
  UnauthorizedException,
  BadRequestException,
  Header,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { XMLParser } from 'fast-xml-parser';
import { AppConfigService } from '../../../config/app-config.service';
import { WecomCryptoService } from './wecom-crypto.service';
import { WecomEventDispatcher } from './wecom-event.dispatcher';

@ApiTags('wecom')
@Controller('wecom/webhook')
export class WecomWebhookController {
  private readonly logger = new Logger(WecomWebhookController.name);
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    cdataPropName: '__cdata',
    // Disable entity processing to prevent XXE attacks
    processEntities: false,
  });

  constructor(
    private readonly config: AppConfigService,
    private readonly crypto: WecomCryptoService,
    private readonly dispatcher: WecomEventDispatcher,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'WeCom callback URL verification',
    description:
      'Used by WeCom to verify the callback URL. ' +
      'Verifies the signature, decrypts the echostr, and returns the plaintext.',
  })
  @ApiQuery({ name: 'msg_signature', required: true })
  @ApiQuery({ name: 'timestamp', required: true })
  @ApiQuery({ name: 'nonce', required: true })
  @ApiQuery({ name: 'echostr', required: true })
  @ApiResponse({ status: 200, description: 'Decrypted echostr plaintext' })
  @ApiResponse({ status: 401, description: 'Signature verification failed' })
  verifyUrl(
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string,
  ): string {
    this.ensureWebhookConfig();

    const { token, encodingAESKey } = this.config.wecom;

    // Verify signature: SHA1(sort([token, timestamp, nonce, echostr]))
    const expectedSig = this.crypto.calculateSignature(
      token!,
      timestamp,
      nonce,
      echostr,
    );
    if (expectedSig !== msgSignature) {
      throw new UnauthorizedException(
        'WeCom callback signature verification failed',
      );
    }

    // Decrypt the echostr to get the plaintext random content
    const plaintext = this.crypto.decrypt(encodingAESKey!, echostr);
    this.logger.debug('WeCom URL verification successful');
    return plaintext;
  }

  @Post()
  @Header('Content-Type', 'text/plain')
  @ApiOperation({
    summary: 'WeCom event callback',
    description:
      'Receives encrypted XML event callbacks from WeCom. ' +
      'Verifies signature, decrypts the message, and dispatches the event to registered handlers.',
  })
  @ApiQuery({ name: 'msg_signature', required: true })
  @ApiQuery({ name: 'timestamp', required: true })
  @ApiQuery({ name: 'nonce', required: true })
  @ApiResponse({ status: 200, description: 'success' })
  @ApiResponse({ status: 401, description: 'Signature verification failed' })
  handleCallback(
    @RawBody() rawBody: Buffer,
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
  ): string {
    this.ensureWebhookConfig();

    const { token, encodingAESKey } = this.config.wecom;

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Empty request body');
    }

    // Parse outer XML to extract the Encrypt field
    const bodyStr = rawBody.toString('utf-8');
    const parsed = this.xmlParser.parse(bodyStr) as {
      xml?: { Encrypt?: string | { __cdata?: string } };
    };
    const encryptRaw = parsed?.xml?.Encrypt;
    const encrypt =
      typeof encryptRaw === 'string' ? encryptRaw : (encryptRaw?.__cdata ?? '');

    if (!encrypt) {
      throw new BadRequestException('Missing <Encrypt> field in callback body');
    }

    // Verify signature: SHA1(sort([token, timestamp, nonce, encrypt]))
    const expectedSig = this.crypto.calculateSignature(
      token!,
      timestamp,
      nonce,
      encrypt,
    );
    if (expectedSig !== msgSignature) {
      throw new UnauthorizedException(
        'WeCom callback signature verification failed',
      );
    }

    // Decrypt the message
    let decryptedXml: string;
    try {
      decryptedXml = this.crypto.decrypt(encodingAESKey!, encrypt);
    } catch (err) {
      this.logger.error(`WeCom AES decryption failed: ${String(err)}`);
      throw new BadRequestException('Failed to decrypt WeCom callback message');
    }

    // Parse the inner XML
    const innerParsed = this.xmlParser.parse(decryptedXml) as {
      xml?: Record<string, unknown>;
    };
    const inner = innerParsed?.xml ?? {};

    // Safely extract string values from parsed XML fields
    const msgType =
      typeof inner.MsgType === 'string' ? inner.MsgType : 'unknown';
    const eventName = typeof inner.Event === 'string' ? inner.Event : undefined;
    const eventType = eventName ? `${msgType}.${eventName}` : msgType;

    this.logger.debug(
      `Received WeCom event: MsgType=${msgType}, Event=${eventName ?? '(none)'}`,
    );

    // Dispatch event asynchronously so the response is returned immediately
    void this.dispatcher.dispatch(eventType, inner);

    return 'success';
  }

  private ensureWebhookConfig(): void {
    const { token, encodingAESKey } = this.config.wecom;
    if (!token || !encodingAESKey) {
      throw new Error(
        'WECOM_TOKEN and WECOM_ENCODING_AES_KEY must be configured for webhook handling',
      );
    }
  }
}
