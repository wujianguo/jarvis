import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({ description: '状态', example: 'pending' })
  status: string;
}
