import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AuthorizeSistemaDto {
  @IsString()
  @IsNotEmpty({ message: 'CodGrupoUsu é obrigatório' })
  @MaxLength(10, { message: 'CodGrupoUsu deve ter no máximo 10 caracteres' })
  codGrupoUsu: string;

  @IsString()
  @IsNotEmpty({ message: 'CodSis é obrigatório' })
  @MaxLength(10, { message: 'CodSis deve ter no máximo 10 caracteres' })
  codSis: string;

  @IsString()
  @IsNotEmpty({ message: 'CodTela é obrigatório' })
  @MaxLength(10, { message: 'CodTela deve ter no máximo 10 caracteres' })
  codTela: string;
}
