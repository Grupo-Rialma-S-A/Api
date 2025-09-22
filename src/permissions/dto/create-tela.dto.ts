import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateTelaDto {
  @IsString()
  @IsNotEmpty({ message: 'CodSis é obrigatório' })
  @MaxLength(10, { message: 'CodSis deve ter no máximo 10 caracteres' })
  codSis: string;

  @IsString()
  @IsNotEmpty({ message: 'CodTela é obrigatório' })
  @MaxLength(10, { message: 'CodTela deve ter no máximo 10 caracteres' })
  codTela: string;

  @IsString()
  @IsNotEmpty({ message: 'DescrTela é obrigatório' })
  @MaxLength(100, { message: 'DescrTela deve ter no máximo 100 caracteres' })
  descrTela: string;

  @IsString()
  @IsNotEmpty({ message: 'DescrMenu é obrigatório' })
  @MaxLength(20, { message: 'DescrMenu deve ter no máximo 20 caracteres' })
  descrMenu: string;

  @IsString()
  @IsNotEmpty({ message: 'LinhaChamada é obrigatório' })
  @MaxLength(20, { message: 'LinhaChamada deve ter no máximo 20 caracteres' })
  linhaChamada: string;
}
