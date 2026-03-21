import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SmsIngestResponseDto {
  @ApiProperty({
    description: '请求是否已进入处理队列（false 表示被幂等去重）',
  })
  accepted: boolean;

  @ApiProperty({
    description: '是否被幂等去重（true 表示该短信在去重窗口内已处理过）',
  })
  deduped: boolean;

  @ApiProperty({
    description: '本次请求的服务端指纹（SHA-256 十六进制字符串）',
  })
  fingerprint: string;

  @ApiPropertyOptional({ description: '附加说明信息' })
  message?: string;
}
