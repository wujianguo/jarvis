import { Module } from '@nestjs/common';
import { SystemModule } from './system/system.module';
import { AppConfigModule } from './config/app-config.module';
import { FeishuModule } from './integrations/feishu/feishu.module';
import { ExpressModule } from './domains/express/express.module';
import { SmsModule } from './domains/sms/sms.module';

@Module({
  imports: [
    AppConfigModule,
    SystemModule,
    FeishuModule,
    ExpressModule,
    SmsModule,
  ],
})
export class AppModule {}
