// interfaces/user.interface.ts
export interface CreateUserDto {
  codUsu: string; // @CodUsu - char(20)
  nomeUsu: string; // @NomeUsu - varchar(100)
  email: string; // @Email - char(50)
  tel?: string; // @Tel - char(20) - opcional
  ramal?: string; // @Ramal - char(10) - opcional
  cel?: string; // @Cel - char(20) - opcional
  senha: string; // @Senha - nvarchar(128)
  trocarSenha?: string; // @TrocarSenha - char(1) - opcional (S/N)
  codGrupoUsu?: number; // @CodGrupoUsu - int - opcional
}

export interface User {
  codUsu: string;
  nomeUsu: string;
  email: string;
  tel?: string;
  ramal?: string;
  cel?: string;
  trocarSenha?: string;
  codGrupoUsu?: number;
  accessToken?: string;
  resetToken?: string;
  tokenUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreateResponse {
  success: boolean;
  message?: string;
  data?: any;
  userId?: string;
  error?: string;
  executionTime?: number;
}
