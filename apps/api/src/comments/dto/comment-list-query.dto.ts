import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageLimitQueryDto } from '../../common/dto/page-limit-query.dto';

export class CommentListQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional({ description: 'Sort: createdAt, id. Prefix with - for DESC.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sort?: string;
}
