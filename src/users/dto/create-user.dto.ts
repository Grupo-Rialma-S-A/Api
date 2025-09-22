import {
  IsString,
  IsEmail,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsNumber,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  nomeUsu: string;

  @IsEmail({}, { message: 'Email deve ter um formato válido' })
  @MaxLength(50, { message: 'Email deve ter no máximo 50 caracteres' })
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Telefone deve ter no máximo 20 caracteres' })
  tel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'Ramal deve ter no máximo 10 caracteres' })
  ramal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Celular deve ter no máximo 20 caracteres' })
  cel?: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  @MaxLength(128, { message: 'Senha deve ter no máximo 128 caracteres' })
  senha: string;

  @IsOptional()
  @IsString()
  @Matches(/^[SN]$/, { message: 'TrocarSenha deve ser S ou N' })
  trocarSenha?: string = 'N';

  @IsOptional()
  @IsString()
  codGrupoUsu?: string;
}
