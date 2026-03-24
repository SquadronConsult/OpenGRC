import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateConnectorInstanceDto {
  @ApiProperty({ description: 'Registry connector identifier' })
  @IsString()
  @IsNotEmpty()
  connectorId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Connector-specific configuration' })
  @IsObject()
  config: Record<string, unknown>;
}

export class UpdateConnectorInstanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true, description: 'Pagination or sync cursor' })
  @IsOptional()
  @IsString()
  cursor?: string | null;
}
