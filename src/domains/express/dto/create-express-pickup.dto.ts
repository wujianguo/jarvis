import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateExpressPickupDto {
  @ApiProperty({ description: '原始信息（快递原始通知内容）' })
  @IsString()
  @IsNotEmpty()
  rawInfo: string;

  @ApiProperty({ description: '取件地址（驿站/快递柜位置）' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: '取件码' })
  @IsString()
  @IsNotEmpty()
  pickupCode: string;
}
