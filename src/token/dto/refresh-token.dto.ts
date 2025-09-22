import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'Refresh token deve ser uma string' })
  @IsNotEmpty({ message: 'Refresh token é obrigatório' })
  refreshToken: string;

  @IsNumber({}, { message: 'codUser deve ser um número' })
  @IsNotEmpty({ message: 'codUser é obrigatório' })
  codUser: number;
}
