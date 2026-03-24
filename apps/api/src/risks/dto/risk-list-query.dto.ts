import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageLimitQueryDto } from '../../common/dto/page-limit-query.dto';

export class RiskListQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional({
    description:
      'Sort: updatedAt, createdAt, title, inherentScore, status. Prefix with - for DESC.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sort?: string;
}
