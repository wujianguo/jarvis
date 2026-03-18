import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class FeishuWebhookDto {
  @ApiPropertyOptional({ description: 'Challenge string for URL verification' })
  @IsOptional()
  @IsString()
  challenge?: string;

  @ApiPropertyOptional({ description: 'Verification token' })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({ description: 'Event type for URL verification' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Event header containing event metadata',
  })
  @IsOptional()
  @IsObject()
  header?: {
    event_id?: string;
    event_type?: string;
    create_time?: string;
    token?: string;
    app_id?: string;
    tenant_key?: string;
  };

  @ApiPropertyOptional({ description: 'Event payload' })
  @IsOptional()
  @IsObject()
  event?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Schema version' })
  @IsOptional()
  @IsString()
  schema?: string;
}

export class FeishuChallengeResponseDto {
  @ApiProperty({ description: 'Echo of the challenge value' })
  challenge: string;
}
