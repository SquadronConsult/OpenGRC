import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: ['20x', 'rev5'] })
  @IsIn(['20x', 'rev5'])
  pathType: '20x' | 'rev5';

  @ApiProperty({ enum: ['low', 'moderate', 'high'] })
  @IsIn(['low', 'moderate', 'high'])
  impactLevel: 'low' | 'moderate' | 'high';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorLabels?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  complianceStartDate?: string;
}

export class AddProjectMemberRequestDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Member role (e.g. member, admin)' })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class GenerateChecklistRequestDto {
  @ApiPropertyOptional({ default: true, description: 'Include KSI indicators when applicable' })
  @IsOptional()
  includeKsi?: boolean;
}

export class CreateProjectSnapshotRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  payload: Record<string, unknown>;
}
