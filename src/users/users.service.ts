import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StoredProceduresService } from '../stored-procedures/stored-procedures.service';
import { DatabaseService } from '../database/database.service';

import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { LogoutUserDto } from './dto/logout-user.dto';

import { UserCreateResponse } from './interfaces/user.interface';
import { LoginResponse, LogoutResponse } from './interfaces/auth.interface';

import { UserValidator } from '../utils/validation/user-validator.util';
import { UserDataCleaner } from '../utils/data/user-data-cleaner.util';
import { UserCodeGenerator } from '../utils/generators/user-code-generator.util';
import { UserQueryBuilder } from '../utils/query-builders/user-query-builder.util';
import { StoredProcedureResponseParser } from '../utils/parsers/stored-procedure-parser.util';
import { RefreshTokenDto } from 'src/token/dto/refresh-token.dto';
import { TokenService } from 'src/token/token.service';

interface UserData {
  codUsu: number;
  nomeUsu?: string;
  email?: string;
  trocarSenha?: boolean;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly storedProceduresService: StoredProceduresService,
    private readonly databaseService: DatabaseService,
    private readonly tokenService: TokenService,
  ) {}

  // ===== AUTENTICAÇÃO VIA STORED PROCEDURES COM TOKENS =====

  async loginUser(loginUserDto: LoginUserDto): Promise<LoginResponse> {
    try {
      this.logger.log(`Login attempt for user: ${loginUserDto.email}`);

      UserValidator.validateLoginData(loginUserDto.email, loginUserDto.senha);

      // 1. Primeiro verifica se o usuário existe
      const userExists = await this.checkUserExists(loginUserDto.email);
      if (!userExists) {
        this.logger.warn(`User not found: ${loginUserDto.email}`);
        return {
          success: false,
          message: 'Usuário não encontrado',
          result: 0,
        };
      }

      // 2. Busca o CodUsu do usuário pelo email
      const userCodUsu = await this.getUserCodUsuByEmail(loginUserDto.email);
      if (!userCodUsu) {
        this.logger.warn(
          `Could not get CodUsu for user: ${loginUserDto.email}`,
        );
        return {
          success: false,
          message: 'Erro ao verificar dados do usuário',
          result: 0,
        };
      }

      // 3. Verifica se o usuário está bloqueado ANTES de tentar fazer login
      const isBlocked = await this.checkUserBlocked(userCodUsu);
      if (isBlocked) {
        this.logger.warn(
          `User is blocked: ${loginUserDto.email}, CodUsu: ${userCodUsu}`,
        );
        return {
          success: false,
          message: 'Usuário foi bloqueado e não pode acessar o sistema',
          result: 0,
        };
      }

      // 4. Agora faz o login propriamente dito com SpLogin
      const query = UserQueryBuilder.buildLoginQuery(
        loginUserDto.email,
        loginUserDto.senha,
      );

      this.logger.log('Executing SpLogin');
      this.logger.log(
        'Query:',
        query.replace(loginUserDto.senha, '[PROTECTED]'),
      );

      const result = await this.databaseService.executeQuery(query);
      this.logger.log('SpLogin raw result:', JSON.stringify(result, null, 2));

      // SpLogin retorna dados se credenciais estão corretas, vazio se incorretas
      if (result && Array.isArray(result) && result.length > 0) {
        // Login bem-sucedido - SpLogin retornou dados
        const firstResult = result[0];
        let loginResult: number;
        let userData: UserData | null = null;

        if (firstResult.LoginResult !== undefined) {
          loginResult = firstResult.LoginResult;
        } else if (firstResult.CodUsu !== undefined) {
          loginResult = firstResult.CodUsu;
          userData = {
            codUsu: firstResult.CodUsu,
            nomeUsu: firstResult.NomeUsu?.trim(),
            email: loginUserDto.email.trim().toLowerCase(),
            trocarSenha: firstResult.TrocarSenha,
          };
          this.logger.log(
            `SpLogin returned user data directly - CodUsu: ${loginResult}`,
          );
        } else {
          // Caso inesperado
          throw new Error('SpLogin retornou formato inesperado');
        }

        if (!userData) {
          const userQuery = UserQueryBuilder.buildGetUserDataQuery();
          const userResult = await this.databaseService.executeQuery(
            userQuery,
            [loginResult],
          );

          userData =
            userResult && userResult.length > 0
              ? {
                  codUsu: userResult[0].CodUsu,
                  nomeUsu: userResult[0].NomeUsu?.trim(),
                  email: userResult[0].Email?.trim(),
                  trocarSenha: userResult[0].TrocarSenha,
                }
              : { codUsu: loginResult };
        }

        // Gera tokens JWT
        const tokens = await this.tokenService.generateTokens({
          codUsu: userData.codUsu,
          email: userData.email || loginUserDto.email,
          nomeUsu: userData.nomeUsu || '',
        });

        // Salva tokens no banco de dados
        await this.tokenService.saveTokensToDatabase(userData.codUsu, tokens);

        const response: LoginResponse = {
          success: true,
          message: `Login realizado com sucesso. CodUsu: ${loginResult}`,
          result: loginResult,
          data: userData,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
          },
        };

        this.logger.log(
          `Login successful for: ${loginUserDto.email}, CodUsu: ${loginResult}`,
        );
        return response;
      } else {
        // SpLogin retornou vazio - senha incorreta (já sabemos que usuário existe e não está bloqueado)
        this.logger.warn(
          `SpLogin returned empty for: ${loginUserDto.email} - invalid password`,
        );

        return {
          success: false,
          message: 'Credenciais inválidas',
          result: 0,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to login user: ${loginUserDto.email}`, error);

      return {
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
        result: -1,
      };
    }
  }

  /**
   * Busca o CodUsu do usuário pelo email usando SpSeUsuario
   */
  private async getUserCodUsuByEmail(email: string): Promise<number | null> {
    try {
      this.logger.log(`Getting CodUsu for email: ${email}`);

      const query = `
      DECLARE @NomeUsu varchar(100) = '';
      
      EXEC SpSeUsuario @NomeUsu
    `;

      const result = await this.databaseService.executeQuery(query, []);

      if (result && Array.isArray(result)) {
        // Procura pelo email na lista de usuários retornados
        const userFound = result.find(
          (user) =>
            user.Email &&
            user.Email.trim().toLowerCase() === email.trim().toLowerCase(),
        );

        if (userFound) {
          this.logger.log(
            `Found CodUsu ${userFound.CodUsu} for email: ${email}`,
          );
          return userFound.CodUsu;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get CodUsu for email: ${email}`, error);
      return null;
    }
  }

  /**
   * Verifica se o usuário está bloqueado usando SpSe1Usuario
   */
  private async checkUserBlocked(codUsu: number): Promise<boolean> {
    try {
      this.logger.log(`Checking if user is blocked: ${codUsu}`);

      const query = `
      DECLARE @CodUsu int = ${codUsu};
      
      EXEC SpSe1Usuario @CodUsu
    `;

      const result = await this.databaseService.executeQuery(query, []);

      if (result && Array.isArray(result) && result.length > 0) {
        const user = result[0];
        const dataBloqueado = user.DataBloqueado;

        // Se DataBloqueado não é null, o usuário está bloqueado
        const isBlocked = dataBloqueado !== null && dataBloqueado !== undefined;

        this.logger.log(
          `User ${codUsu} blocked status: ${isBlocked}, DataBloqueado: ${dataBloqueado}`,
        );

        return isBlocked;
      }

      // Se não encontrou o usuário, considera como não bloqueado
      // (o SpLogin já validou que o usuário existe)
      this.logger.warn(`User not found in SpSe1Usuario: ${codUsu}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to check if user is blocked: ${codUsu}`, error);
      // Em caso de erro na verificação, permite prosseguir com o login
      // para não bloquear usuários válidos por erro técnico
      return false;
    }
  }
  /**
   * Verifica se o usuário existe usando SpSeUsuario
   */
  private async checkUserExists(email: string): Promise<boolean> {
    try {
      this.logger.log(`Checking if user exists: ${email}`);

      const query = `
      DECLARE @NomeUsu varchar(100) = '';
      
      EXEC SpSeUsuario @NomeUsu
    `;

      const result = await this.databaseService.executeQuery(query, []);

      if (result && Array.isArray(result)) {
        // Procura pelo email na lista de usuários retornados
        const userFound = result.find(
          (user) =>
            user.Email &&
            user.Email.trim().toLowerCase() === email.trim().toLowerCase(),
        );

        const exists = !!userFound;
        this.logger.log(`User ${email} exists: ${exists}`);

        return exists;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to check if user exists: ${email}`, error);
      // Em caso de erro na verificação, permite prosseguir com o login
      // para não bloquear usuários válidos
      return true;
    }
  }

  async logoutUser(logoutUserDto: LogoutUserDto): Promise<LogoutResponse> {
    try {
      this.logger.log(`Logout attempt for user: ${logoutUserDto.codUsu}`);
      UserValidator.validateLogoutData(logoutUserDto.codUsu);

      // Revoga tokens antes de executar logout
      await this.tokenService.revokeTokens(logoutUserDto.codUsu);

      const query = UserQueryBuilder.buildLogoutQuery(logoutUserDto.codUsu);

      this.logger.log('Executing SpLogout:', query);

      const result = await this.databaseService.executeQuery(query);
      this.logger.log('SpLogout raw result:', JSON.stringify(result, null, 2));

      if (result && result.length > 0) {
        const user = result[0];

        this.logger.log(`Logout successful for user: ${logoutUserDto.codUsu}`);
        return {
          success: true,
          message: 'Logout realizado com sucesso',
          result: user, // retorna o objeto completo do SP
        };
      }

      this.logger.warn(
        `Logout failed for: ${logoutUserDto.codUsu} (sem retorno do SP)`,
      );

      return {
        success: false,
        message: 'Erro interno do sistema',
        // @ts-ignore
        result: null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to logout user: ${logoutUserDto.codUsu}`,
        error,
      );

      return {
        success: false,
        message: 'Erro ao realizar logout',
        error: error.message,
        // @ts-ignore
        result: null,
      };
    }
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<any> {
    try {
      this.logger.log(
        `Refresh tokens attempt for user: ${refreshTokenDto.codUser}`,
      );

      const tokens = await this.tokenService.refreshTokens(
        refreshTokenDto.refreshToken,
        refreshTokenDto.codUser,
      );

      if (!tokens) {
        this.logger.warn(
          `Invalid or expired refresh token for user: ${refreshTokenDto.codUser} - logout required`,
        );
        return {
          success: false,
          error: 'Refresh token inválido ou expirado',
          logout: true, // Indica que cliente deve fazer logout
        };
      }

      this.logger.log(
        `Access token refreshed successfully for user: ${refreshTokenDto.codUser}`,
      );

      return {
        success: true,
        message: 'Access token atualizado com sucesso',
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken, // Mesmo refresh token
          expiresIn: tokens.expiresIn,
          tokenType: 'Bearer',
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh tokens for user: ${refreshTokenDto.codUser}`,
        error,
      );

      return {
        success: false,
        error: 'Falha ao atualizar tokens',
        logout: true, // Em caso de erro, também força logout
      };
    }
  }
  q;
  // ===== CRUD DE USUÁRIOS =====

  async createUser(createUserDto: CreateUserDto): Promise<UserCreateResponse> {
    try {
      this.logger.log(`Creating user: ${createUserDto.email}`);

      // Validação usando utilitário
      await UserValidator.validateUserData(
        createUserDto.email,
        createUserDto.tel,
        createUserDto.cel,
        (email) => this.checkEmailExists(email),
      );

      // Geração de código usando utilitário
      const generatedCodUsu = await UserCodeGenerator.generateUniqueCodUsu(
        (code) => this.getUserExists(code),
        () => this.getUsersCount(),
      );

      let parameters;
      try {
        parameters = await this.getStoredProcedureParameters('SpGrUsuario');
        this.logger.log('SpGrUsuario parameters:', parameters);
      } catch (error) {
        this.logger.warn(
          'Could not get procedure parameters, trying direct query approach',
        );
        return await this.createUserWithDirectQuery(
          createUserDto,
          generatedCodUsu,
        );
      }

      // Parâmetros da stored procedure incluindo CodGrupoUsu
      const procedureParams = [
        generatedCodUsu, // @CodUsu
        createUserDto.nomeUsu.trim(), // @NomeUsu
        createUserDto.email.trim().toLowerCase(), // @Email
        createUserDto.tel?.trim() || null, // @Tel
        createUserDto.ramal?.trim() || null, // @Ramal
        createUserDto.cel?.trim() || null, // @Cel
        createUserDto.senha, // @Senha
        createUserDto.trocarSenha || 'N', // @TrocarSenha
        createUserDto.codGrupoUsu || 1, // @CodGrupoUsu - Valor padrão 1
      ];

      this.logger.log(
        `Executing SpGrUsuario with CodUsu=${generatedCodUsu} and parameters:`,
        procedureParams.map(
          (param, index) => (index === 6 ? '[PROTECTED]' : param), // Protege a senha no log
        ),
      );

      const result =
        await this.storedProceduresService.executeStoredProcedureWithParams(
          'SpGrUsuario',
          procedureParams,
        );

      if (result.success) {
        const response = StoredProcedureResponseParser.parseResponse(
          result.data,
        );

        return {
          success: true,
          message: response.message || 'Usuário criado com sucesso',
          data: {
            ...response.data,
            codUsu: generatedCodUsu,
            codGrupoUsu: createUserDto.codGrupoUsu || '',
          },
          userId: generatedCodUsu.toString(),
          executionTime: result.executionTime,
        };
      } else {
        throw new Error(result.error || 'Falha ao executar SpGrUsuario');
      }
    } catch (error) {
      this.logger.error(`Failed to create user: ${createUserDto.email}`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.log('Falling back to direct query approach');
      return await this.createUserWithDirectQuery(createUserDto);
    }
  }

  private async createUserWithDirectQuery(
    createUserDto: CreateUserDto,
    providedCodUsu?: number,
  ): Promise<UserCreateResponse> {
    try {
      this.logger.log(
        `Creating user with direct query: ${createUserDto.email}`,
      );

      const generatedCodUsu =
        providedCodUsu ||
        (await UserCodeGenerator.generateUniqueCodUsu(
          (code) => this.getUserExists(code),
          () => this.getUsersCount(),
        ));

      // Use explicit parameter declarations for SQL Server
      const query = `
      DECLARE @CodUsu int = ${generatedCodUsu};
      DECLARE @NomeUsu varchar(100) = '${createUserDto.nomeUsu.trim().replace(/'/g, "''")}';
      DECLARE @Email varchar(50) = '${createUserDto.email.trim().toLowerCase().replace(/'/g, "''")}';
      DECLARE @Tel varchar(20) = ${createUserDto.tel ? `'${createUserDto.tel.trim().replace(/'/g, "''")}'` : 'NULL'};
      DECLARE @Ramal varchar(10) = ${createUserDto.ramal ? `'${createUserDto.ramal.trim().replace(/'/g, "''")}'` : 'NULL'};
      DECLARE @Cel varchar(20) = ${createUserDto.cel ? `'${createUserDto.cel.trim().replace(/'/g, "''")}'` : 'NULL'};
      DECLARE @Senha nvarchar(128) = '${createUserDto.senha.replace(/'/g, "''")}';
      DECLARE @TrocarSenha char(1) = '${createUserDto.trocarSenha || 'N'}';
      DECLARE @CodGrupoUsu int = ${createUserDto.codGrupoUsu || ''};
      
      EXEC SpGrUsuario @CodUsu, @NomeUsu, @Email, @Tel, @Ramal, @Cel, @Senha, @TrocarSenha, @CodGrupoUsu
    `;

      this.logger.log(
        `Executing direct query for user: ${createUserDto.email} with CodUsu: ${generatedCodUsu}`,
      );

      // Execute without parameters since they're embedded in the query
      const result = await this.databaseService.executeQuery(query, []);

      this.logger.log(`SpGrUsuario result:`, result);

      const response = StoredProcedureResponseParser.parseResponse(result);

      const cleanedData = UserDataCleaner.cleanUserData({
        ...response.data,
        codUsu: generatedCodUsu,
        nomeUsu: createUserDto.nomeUsu.trim(),
        email: createUserDto.email.trim().toLowerCase(),
        tel: createUserDto.tel?.trim() || null,
        ramal: createUserDto.ramal?.trim() || null,
        cel: createUserDto.cel?.trim() || null,
        trocarSenha: createUserDto.trocarSenha || 'N',
        codGrupoUsu: createUserDto.codGrupoUsu || '',
      });

      this.logger.log(`User created successfully: ${generatedCodUsu}`);

      return {
        success: true,
        message: response.message || 'Usuário criado com sucesso',
        data: cleanedData,
        userId: generatedCodUsu.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create user: ${createUserDto.email}`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      return {
        success: false,
        error: error.message,
        userId: undefined,
      };
    }
  }

  async getUserByCode(codUsu: string): Promise<any> {
    try {
      this.logger.log(`Searching for user: ${codUsu}`);

      const query = UserQueryBuilder.buildGetUserQuery();
      const result = await this.databaseService.executeQuery(query, [
        codUsu.trim(),
      ]);

      if (result && result.length > 0) {
        const cleanedData = UserDataCleaner.cleanUserData(result[0]);

        this.logger.log(`User found: ${codUsu}`);
        return {
          success: true,
          data: cleanedData,
          message: 'Usuário encontrado com sucesso',
        };
      } else {
        this.logger.log(`User not found: ${codUsu}`);
        return {
          success: false,
          data: null,
          message: 'Usuário não encontrado',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to get user: ${codUsu}`, error);
      throw new Error(`Falha ao buscar usuário: ${error.message}`);
    }
  }

  async getAllUsers(
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<{
    success: boolean;
    data: any[];
    total?: number;
    page?: number;
    limit?: number;
    message: string;
  }> {
    try {
      this.logger.log('Getting all users');

      const { query, params, countQuery, countParams } =
        UserQueryBuilder.buildGetAllUsersQuery(search, page, limit);

      this.logger.log(`Executing query: ${query}`);
      this.logger.log(`Query params:`, params);

      const result = await this.databaseService.executeQuery(query, params);

      let total = 0;
      if (page && limit && countQuery && countParams) {
        const countResult = await this.databaseService.executeQuery(
          countQuery,
          countParams,
        );
        total = countResult[0]?.Total || 0;
      }

      const cleanedData = UserDataCleaner.cleanUserData(result || []);

      this.logger.log(`Found ${result?.length || 0} users`);

      return {
        success: true,
        data: cleanedData,
        total: page && limit ? total : result?.length || 0,
        page: page,
        limit: limit,
        message: `${result?.length || 0} usuário(s) encontrado(s)`,
      };
    } catch (error) {
      this.logger.error('Failed to get all users', error);
      throw new Error(`Falha ao buscar usuários: ${error.message}`);
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  async checkEmailExists(email: string): Promise<boolean> {
    try {
      this.logger.log(`Checking if email exists: ${email}`);

      const query = UserQueryBuilder.buildCheckEmailExistsQuery();
      const result = await this.databaseService.executeQuery(query, [
        email.trim().toLowerCase(),
      ]);

      this.logger.log(`Email check query result:`, result);

      const exists = result && result.length > 0 && result[0].EmailCount > 0;
      this.logger.log(`Email exists check for ${email}: ${exists}`);

      return exists;
    } catch (error) {
      this.logger.warn(`Failed to check if email exists: ${email}`, error);
      return false;
    }
  }

  async getUserExists(codUsu: string): Promise<boolean> {
    try {
      this.logger.log(`Checking if user exists: ${codUsu}`);

      const query = UserQueryBuilder.buildCheckUserExistsQuery();
      const result = await this.databaseService.executeQuery(query, [
        codUsu.trim(),
      ]);

      const exists = result && result.length > 0 && result[0].UserCount > 0;
      this.logger.log(`User exists check for ${codUsu}: ${exists}`);

      return exists;
    } catch (error) {
      this.logger.warn(`Failed to check if user exists: ${codUsu}`, error);
      return false;
    }
  }

  async getStoredProcedureParameters(procedureName: string): Promise<any[]> {
    try {
      const query = UserQueryBuilder.buildGetStoredProcedureParametersQuery();
      const result = await this.databaseService.executeQuery(query, [
        procedureName,
      ]);

      this.logger.log(`Parameters for ${procedureName}:`, result);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get procedure parameters for ${procedureName}`,
        error,
      );
      throw error;
    }
  }

  private async getUsersCount(): Promise<number> {
    try {
      const query = UserQueryBuilder.buildGetUsersCountQuery();
      const result = await this.databaseService.executeQuery(query);
      return result[0]?.Total || 0;
    } catch (error) {
      this.logger.warn('Failed to get users count', error);
      return 0;
    }
  }
}
