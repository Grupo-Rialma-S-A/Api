import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class LogoutUserDto {
  @IsNumber({}, { message: 'CodUsu deve ser um número' })
  @IsNotEmpty({ message: 'CodUsu é obrigatório' })
  // @MaxLength(20, { message: 'CodUsu deve ter no máximo 20 caracteres' })
  codUsu: number;
}
