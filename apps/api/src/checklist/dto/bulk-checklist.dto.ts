import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class BulkChecklistPatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;
}
