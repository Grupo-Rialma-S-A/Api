import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSistemaDto {
  @IsString()
  @IsNotEmpty({ message: 'CodSis é obrigatório' })
  @MaxLength(10, { message: 'CodSis deve ter no máximo 10 caracteres' })
  codSis: string;

  @IsString()
  @IsNotEmpty({ message: 'DescrSis é obrigatório' })
  @MaxLength(100, { message: 'DescrSis deve ter no máximo 100 caracteres' })
  descrSis: string;

  @IsString()
  @IsNotEmpty({ message: 'DescrMenu é obrigatório' })
  @MaxLength(20, { message: 'DescrMenu deve ter no máximo 20 caracteres' })
  descrMenu: string;
}
