import { Module } from '@nestjs/common';
import { FeishuModule } from '../../integrations/feishu/feishu.module';
import { ExpressPickupsController } from './express-pickups.controller';
import { ExpressPickupsService } from './express-pickups.service';

@Module({
  imports: [FeishuModule],
  controllers: [ExpressPickupsController],
  providers: [ExpressPickupsService],
})
export class ExpressModule {}
