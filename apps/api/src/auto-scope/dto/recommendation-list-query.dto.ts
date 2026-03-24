import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PageLimitQueryDto } from '../../common/dto/page-limit-query.dto';

export class AutoScopeRecommendationListQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  decision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  runId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minConfidence?: number;

  @ApiPropertyOptional({ description: 'Sort: createdAt, confidence. Prefix with - for DESC.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sort?: string;
}
