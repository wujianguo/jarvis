import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MarkDoneByCodeDto {
  @ApiProperty({ description: '取件码', example: '12345' })
  @IsString()
  @IsNotEmpty()
  pickupCode: string;
}
