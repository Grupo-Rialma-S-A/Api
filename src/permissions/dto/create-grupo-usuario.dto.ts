import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateGrupoUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'CodGrupoUsu é obrigatório' })
  @MaxLength(10, { message: 'CodGrupoUsu deve ter no máximo 10 caracteres' })
  codGrupoUsu: string;

  @IsString()
  @IsNotEmpty({ message: 'DescrGrupoUsu é obrigatório' })
  @MaxLength(80, { message: 'DescrGrupoUsu deve ter no máximo 80 caracteres' })
  descrGrupoUsu: string;
}
