import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class IngestSmsDto {
  @ApiProperty({ description: '短信正文（必填）' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: '发件人号码或签名（预留字段，当前不参与处理）',
  })
  @IsOptional()
  @IsString()
  sender?: string;

  @ApiPropertyOptional({
    description: '短信接收时间（ISO 8601 字符串，可选，用于幂等指纹计算）',
  })
  @IsOptional()
  @IsISO8601()
  receivedAt?: string;

  @ApiPropertyOptional({ description: '触发设备标识（可选，用于排查问题）' })
  @IsOptional()
  @IsString()
  device?: string;
}
