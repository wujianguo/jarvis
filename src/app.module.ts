import { Module } from '@nestjs/common';
import { SystemModule } from './system/system.module';
import { AppConfigModule } from './config/app-config.module';
import { FeishuModule } from './integrations/feishu/feishu.module';
import { ExpressModule } from './domains/express/express.module';
import { SmsModule } from './domains/sms/sms.module';
import { WecomDomainModule } from './domains/wecom/wecom.module';

@Module({
  imports: [
    AppConfigModule,
    SystemModule,
    FeishuModule,
    ExpressModule,
    SmsModule,
    WecomDomainModule,
  ],
})
export class AppModule {}
