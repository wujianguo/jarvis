import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KvModule } from '../kv/kv.module';
import { WecomAuthService } from './auth/wecom-auth.service';
import { WecomHttpService } from './http/wecom-http.service';
import { WecomMessageService } from './message/wecom-message.service';
import { WecomCryptoService } from './webhook/wecom-crypto.service';
import { WecomEventDispatcher } from './webhook/wecom-event.dispatcher';
import { WecomWebhookController } from './webhook/wecom-webhook.controller';

@Module({
  imports: [HttpModule, KvModule],
  providers: [
    WecomAuthService,
    WecomHttpService,
    WecomMessageService,
    WecomCryptoService,
    WecomEventDispatcher,
  ],
  controllers: [WecomWebhookController],
  exports: [
    WecomAuthService,
    WecomHttpService,
    WecomMessageService,
    WecomCryptoService,
    WecomEventDispatcher,
  ],
})
export class WecomModule {}
