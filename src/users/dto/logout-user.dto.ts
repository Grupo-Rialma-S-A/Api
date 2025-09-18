import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LogoutUserDto {
  @IsString({ message: 'CodUsu deve ser uma string' })
  @IsNotEmpty({ message: 'CodUsu é obrigatório' })
  @MaxLength(20, { message: 'CodUsu deve ter no máximo 20 caracteres' })
  codUsu: string;
}
