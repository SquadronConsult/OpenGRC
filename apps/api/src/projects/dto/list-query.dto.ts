import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PageLimitQueryDto } from '../../common/dto/page-limit-query.dto';

export class ProjectListQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional({
    description: 'Sort field: createdAt, name, pathType. Prefix with - for DESC.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sort?: string;
}

export class ChecklistListQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional({
    description:
      'Sort: id, status, dueDate, reviewState. Prefix with - for DESC (e.g. -dueDate).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sort?: string;
}

export class EvidenceGapsQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional({ description: 'Stale automated evidence threshold in days', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  staleDays?: number;
}
