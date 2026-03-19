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
import { FeishuTaskService } from './task/feishu-task.service';
import { FeishuTaskEventHandler } from './task/feishu-task-event.handler';

@Module({
  imports: [HttpModule, KvModule],
  providers: [
    FeishuAuthService,
    FeishuHttpService,
    FeishuBitableService,
    FeishuSheetsService,
    FeishuStorageService,
    FeishuEventDispatcher,
    FeishuTaskService,
    FeishuTaskEventHandler,
  ],
  controllers: [FeishuWebhookController],
  exports: [
    FeishuAuthService,
    FeishuHttpService,
    FeishuBitableService,
    FeishuSheetsService,
    FeishuStorageService,
    FeishuEventDispatcher,
    FeishuTaskService,
  ],
})
export class FeishuModule {}
