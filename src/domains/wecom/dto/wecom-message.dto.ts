import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SendTextMessageDto {
  @ApiPropertyOptional({
    description:
      'Comma-separated user IDs to send to, or "@all" for all members',
    example: 'user1,user2',
  })
  @IsOptional()
  @IsString()
  toUser?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated department IDs',
    example: '1,2',
  })
  @IsOptional()
  @IsString()
  toParty?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated tag IDs',
    example: '1',
  })
  @IsOptional()
  @IsString()
  toTag?: string;

  @ApiProperty({
    description: 'Text message content',
    example: 'Hello from Jarvis!',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: '0 = non-confidential (default), 1 = confidential',
    enum: [0, 1],
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @IsIn([0, 1])
  @Type(() => Number)
  safe?: 0 | 1;
}

export class SendMessageResponseDto {
  @ApiProperty({ description: 'WeCom error code (0 = success)', example: 0 })
  errcode: number;

  @ApiProperty({ description: 'WeCom error message', example: 'ok' })
  errmsg: string;

  @ApiPropertyOptional({
    description: 'Invalid user IDs (comma-separated)',
  })
  invaliduser?: string;

  @ApiPropertyOptional({
    description: 'Invalid party IDs (comma-separated)',
  })
  invalidparty?: string;

  @ApiPropertyOptional({
    description: 'Invalid tag IDs (comma-separated)',
  })
  invalidtag?: string;

  @ApiPropertyOptional({
    description: 'Unlicensed user IDs (comma-separated)',
  })
  unlicenseduser?: string;

  @ApiPropertyOptional({
    description: 'Message ID',
  })
  msgid?: string;
}
