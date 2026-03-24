import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePolicyDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
