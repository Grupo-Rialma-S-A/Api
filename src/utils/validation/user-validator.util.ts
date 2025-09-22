import { BadRequestException } from '@nestjs/common';

export class UserValidator {
  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Email deve ter um formato válido');
    }
  }

  static validatePhone(phone: string, fieldName: string): void {
    if (phone && !/^[\d\s\-\(\)\+]+$/.test(phone)) {
      throw new BadRequestException(
        `${fieldName} deve conter apenas números e caracteres válidos`,
      );
    }
  }

  static validatePassword(senha: string): void {
    if (!senha || senha.trim().length === 0) {
      throw new BadRequestException('Senha é obrigatória');
    }
  }

  static validateCodUsu(codUsu: number): void {
    if (!codUsu || codUsu <= 0) {
      throw new BadRequestException('CodUsu é obrigatório');
    }
  }

  static validateLoginData(email: string, senha: string): void {
    this.validateEmail(email);
    this.validatePassword(senha);
  }

  static validateLogoutData(codUsu: number): void {
    this.validateCodUsu(codUsu);
  }

  static async validateUserData(
    email: string,
    tel?: string,
    cel?: string,
    checkEmailExistsFn?: (email: string) => Promise<boolean>,
  ): Promise<void> {
    this.validateEmail(email);

    if (checkEmailExistsFn) {
      const emailExists = await checkEmailExistsFn(email);
      if (emailExists) {
        throw new BadRequestException(
          'Este email já está cadastrado no sistema',
        );
      }
    }

    if (tel) {
      this.validatePhone(tel, 'Telefone');
    }

    if (cel) {
      this.validatePhone(cel, 'Celular');
    }
  }

  /**
   * Valida se o usuário existe antes do login
   */
  static async validateUserExistsForLogin(
    email: string,
    checkUserExistsFn: (email: string) => Promise<boolean>,
  ): Promise<void> {
    const userExists = await checkUserExistsFn(email);
    if (!userExists) {
      throw new BadRequestException('Usuário não encontrado');
    }
  }
}

export class UserQueryBuilder {
  static buildLoginQuery(email: string, senha: string): string {
    return `
      DECLARE @Result INT;
      EXEC @Result = SpLogin 
        '${email.trim().toLowerCase().replace(/'/g, "''")}',
        '${senha.replace(/'/g, "''")}';
      SELECT @Result AS LoginResult;
    `;
  }

  /**
   * Query para verificar se usuário existe usando SpSeUsuario
   */
  static buildCheckUserExistsQuery(): string {
    return `
      DECLARE @NomeUsu varchar(100) = '';
      EXEC SpSeUsuario @NomeUsu
    `;
  }

  static buildGetUserDataQuery(): string {
    return `
      SELECT CodUsu, NomeUsu, Email, TrocarSenha 
      FROM Usuario 
      WHERE CodUsu = ?
    `;
  }
}
