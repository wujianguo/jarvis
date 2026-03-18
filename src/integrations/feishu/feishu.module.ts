import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KvModule } from '../kv/kv.module';
import { FeishuAuthService } from './auth/feishu-auth.service';
import { FeishuHttpService } from './http/feishu-http.service';
import { FeishuBitableService } from './bitable/feishu-bitable.service';
import { FeishuSheetsService } from './sheets/feishu-sheets.service';
import { FeishuStorageService } from './storage/feishu-storage.service';
import { FeishuEventDispatcher } from './webhook/feishu-event.dispatcher';
import { FeishuWebhookController } from './webhook/feishu-webhook.controller';

@Module({
  imports: [HttpModule, KvModule],
  providers: [
    FeishuAuthService,
    FeishuHttpService,
    FeishuBitableService,
    FeishuSheetsService,
    FeishuStorageService,
    FeishuEventDispatcher,
  ],
  controllers: [FeishuWebhookController],
  exports: [
    FeishuAuthService,
    FeishuHttpService,
    FeishuBitableService,
    FeishuSheetsService,
    FeishuStorageService,
    FeishuEventDispatcher,
  ],
})
export class FeishuModule {}
