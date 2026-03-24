import { Module } from '@nestjs/common';
import { WecomModule as WecomIntegrationModule } from '../../integrations/wecom/wecom.module';
import { WecomMessagesController } from './wecom-messages.controller';

@Module({
  imports: [WecomIntegrationModule],
  controllers: [WecomMessagesController],
})
export class WecomDomainModule {}
