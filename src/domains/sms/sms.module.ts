import { Module } from '@nestjs/common';
import { KvModule } from '../../integrations/kv/kv.module';
import { ExpressModule } from '../express/express.module';
import { SmsIngestController } from './sms-ingest.controller';
import { SmsIngestService } from './sms-ingest.service';
import { SmsAiService } from './sms-ai.service';
import { ExpressPickupSmsHandler } from './handlers/express-pickup-sms.handler';
import { SMS_HANDLER, SmsHandler } from './interfaces/sms-handler.interface';

@Module({
  imports: [KvModule, ExpressModule],
  controllers: [SmsIngestController],
  providers: [
    SmsIngestService,
    SmsAiService,
    ExpressPickupSmsHandler,
    {
      provide: SMS_HANDLER,
      useFactory: (handler: ExpressPickupSmsHandler): SmsHandler[] => [handler],
      inject: [ExpressPickupSmsHandler],
    },
  ],
})
export class SmsModule {}
