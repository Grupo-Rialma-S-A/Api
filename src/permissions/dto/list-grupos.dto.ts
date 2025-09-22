import { IsOptional } from 'class-validator';

export class ListGruposDto {
  @IsOptional()
  search?: string;
}
