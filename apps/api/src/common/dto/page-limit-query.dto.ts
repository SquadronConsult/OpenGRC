import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;

/** Shared query: `page` (1-based) and `limit` (capped). */
export class PageLimitQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: DEFAULT_LIST_LIMIT,
    minimum: 1,
    maximum: MAX_LIST_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit?: number = DEFAULT_LIST_LIMIT;
}

export function skipTakeFromPageLimit(d: PageLimitQueryDto): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  const page = d.page ?? DEFAULT_PAGE;
  const limit = d.limit ?? DEFAULT_LIST_LIMIT;
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
