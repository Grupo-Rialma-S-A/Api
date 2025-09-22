// src/users/dto/block-user.dto.ts
import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class BlockUserDto {
  @IsNotEmpty({ message: 'CodUsu é obrigatório' })
  @Type(() => Number)
  @IsNumber({}, { message: 'CodUsu deve ser um número' })
  @IsPositive({ message: 'CodUsu deve ser um número positivo' })
  codUsu: number;
}
