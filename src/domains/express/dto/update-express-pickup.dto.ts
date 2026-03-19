import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateExpressPickupDto {
  @ApiPropertyOptional({ description: '原始信息（快递原始通知内容）' })
  @IsString()
  @IsOptional()
  rawInfo?: string;

  @ApiPropertyOptional({ description: '取件地址（驿站/快递柜位置）' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: '取件码' })
  @IsString()
  @IsOptional()
  pickupCode?: string;
}
