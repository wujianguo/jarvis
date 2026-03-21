import { Injectable, Logger } from '@nestjs/common';
import {
  SmsHandler,
  SmsJob,
  SmsClassificationResult,
} from '../interfaces/sms-handler.interface';
import { ExpressPickupsService } from '../../express/express-pickups.service';
import { CreateExpressPickupDto } from '../../express/dto/create-express-pickup.dto';

@Injectable()
export class ExpressPickupSmsHandler implements SmsHandler {
  private readonly logger = new Logger(ExpressPickupSmsHandler.name);

  constructor(private readonly expressPickupsService: ExpressPickupsService) {}

  canHandle(classified: SmsClassificationResult): boolean {
    return (
      classified.kind === 'express_pickup' &&
      typeof classified.pickupCode === 'string' &&
      classified.pickupCode.trim().length > 0
    );
  }

  async handle(
    job: SmsJob,
    classified: SmsClassificationResult,
  ): Promise<void> {
    const dto: CreateExpressPickupDto = {
      rawInfo: job.content,
      address: classified.address ?? '',
      pickupCode: classified.pickupCode ?? '',
    };

    this.logger.log(
      `Creating express pickup record: pickupCode=${dto.pickupCode}`,
    );
    await this.expressPickupsService.create(dto);
  }
}
