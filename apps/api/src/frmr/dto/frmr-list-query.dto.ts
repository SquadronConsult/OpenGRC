import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageLimitQueryDto } from '../../common/dto/page-limit-query.dto';

export class FrmrTermQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;
}

export class FrmrRequirementQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  process?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  layer?: string;
}

export class FrmrKsiQueryDto extends PageLimitQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  domain?: string;
}
