import { IsNumber, IsNotEmpty } from 'class-validator';

export class GetPermissionsDto {
  @IsNumber({}, { message: 'CodUsu deve ser um número' })
  @IsNotEmpty({ message: 'CodUsu é obrigatório' })
  codUsu: number;
}
