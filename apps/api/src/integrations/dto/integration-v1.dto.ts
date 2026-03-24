import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EvidenceAssertionDto {
  @ApiPropertyOptional({ enum: ['pass', 'fail', 'warn', 'info'] })
  @IsOptional()
  @IsString()
  @IsIn(['pass', 'fail', 'warn', 'info'])
  status?: 'pass' | 'fail' | 'warn' | 'info';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  measuredAt?: string;
}

export class EvidenceUpsertItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  checklistItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  framework?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  controlId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  evidenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  externalUri?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceRunId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceConnector?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => EvidenceAssertionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EvidenceAssertionDto)
  assertion?: EvidenceAssertionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  artifactType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  collectionStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  collectionEnd?: string;
}

export class EvidenceUpsertRequestDto extends EvidenceUpsertItemDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class EvidenceBulkIngestRequestDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @ApiProperty({ type: [EvidenceUpsertItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvidenceUpsertItemDto)
  items: EvidenceUpsertItemDto[];
}

export class LinkControlRequestDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty()
  @IsUUID()
  checklistItemId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  framework: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  controlId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ResolveControlRequestDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  framework: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  controlId: string;
}

export class AutoScopeTriggerRequestDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class CreateIntegrationCredentialDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;
}

/** Body for POST credentials (project id is in the URL). */
export class CreateIntegrationCredentialBodyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;
}

export class CreateIntegrationProjectRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ enum: ['20x', 'rev5'] })
  @IsOptional()
  @IsIn(['20x', 'rev5'])
  pathType?: '20x' | 'rev5';

  @ApiPropertyOptional({ enum: ['low', 'moderate', 'high'] })
  @IsOptional()
  @IsIn(['low', 'moderate', 'high'])
  impactLevel?: 'low' | 'moderate' | 'high';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorLabels?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  complianceStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeKsi?: boolean;
}

/** Legacy CI webhook: attach pipeline evidence to a checklist item. */
export class CiEvidenceIngestDto {
  @ApiProperty()
  @IsUUID()
  checklistItemId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buildUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  log?: string;
}

/** Legacy scanner webhook: attach vuln summary evidence to a checklist item. */
export class ScannerSummaryIngestDto {
  @ApiProperty()
  @IsUUID()
  checklistItemId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scanner?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  critical?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  high?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  medium?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  low?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportUrl?: string;
}
