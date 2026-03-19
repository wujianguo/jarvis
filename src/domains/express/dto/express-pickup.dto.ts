import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpressPickupStatus } from '../express-pickup-status.enum';

export class ExpressPickupDto {
  @ApiProperty({ description: '取件记录 ID' })
  id: string;

  @ApiProperty({ description: '原始信息' })
  rawInfo: string;

  @ApiProperty({ description: '取件地址' })
  address: string;

  @ApiProperty({ description: '取件码' })
  pickupCode: string;

  @ApiPropertyOptional({ description: '关联飞书任务 ID' })
  taskId?: string;

  @ApiProperty({ description: '状态', enum: ExpressPickupStatus })
  status: ExpressPickupStatus;

  @ApiProperty({ description: '创建时间（ISO8601 +08:00）' })
  createdAt: string;

  @ApiProperty({ description: '更新时间（ISO8601 +08:00）' })
  updatedAt: string;
}
