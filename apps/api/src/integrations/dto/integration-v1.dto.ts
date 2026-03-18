import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EvidenceAssertionDto {
  @IsOptional()
  @IsString()
  @IsIn(['pass', 'fail', 'warn', 'info'])
  status?: 'pass' | 'fail' | 'warn' | 'info';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsDateString()
  measuredAt?: string;
}

export class EvidenceUpsertItemDto {
  @IsOptional()
  @IsUUID()
  checklistItemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  framework?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  controlId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  evidenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  externalUri?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceRunId?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceConnector?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => EvidenceAssertionDto)
  assertion?: EvidenceAssertionDto;
}

export class EvidenceUpsertRequestDto extends EvidenceUpsertItemDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class EvidenceBulkIngestRequestDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvidenceUpsertItemDto)
  items: EvidenceUpsertItemDto[];
}

export class LinkControlRequestDto {
  @IsUUID()
  projectId: string;

  @IsUUID()
  checklistItemId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  framework: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  controlId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ResolveControlRequestDto {
  @IsUUID()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  framework: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  controlId: string;
}

export class AutoScopeTriggerRequestDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class CreateIntegrationCredentialDto {
  @IsUUID()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;
}

export class CreateIntegrationProjectRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsIn(['20x', 'rev5'])
  pathType?: '20x' | 'rev5';

  @IsOptional()
  @IsIn(['low', 'moderate', 'high'])
  impactLevel?: 'low' | 'moderate' | 'high';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorLabels?: string;

  @IsOptional()
  @IsDateString()
  complianceStartDate?: string;

  @IsOptional()
  @IsBoolean()
  includeKsi?: boolean;
}

