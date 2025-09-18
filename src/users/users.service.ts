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
  ) {}

  // ===== AUTENTICAÇÃO VIA STORED PROCEDURES =====

  async loginUser(loginUserDto: LoginUserDto): Promise<LoginResponse> {
    try {
      this.logger.log(`Login attempt for user: ${loginUserDto.email}`);

      UserValidator.validateLoginData(loginUserDto.email, loginUserDto.senha);

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

      let loginResult: number;
      let userData: UserData | null = null;

      if (result && Array.isArray(result) && result.length > 0) {
        const firstResult = result[0];

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
          loginResult = -1;
        }
      } else {
        loginResult = -1;
      }

      this.logger.log(`SpLogin result: ${loginResult}`);

      const isSuccess = loginResult > 0;

      if (isSuccess) {
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

        const response: LoginResponse = {
          success: true,
          message: `Login realizado com sucesso. CodUsu: ${loginResult}`,
          result: loginResult,
          data: userData,
        };

        this.logger.log(
          `Login successful for: ${loginUserDto.email}, CodUsu: ${loginResult}`,
        );
        return response;
      } else {
        const message =
          loginResult === 0
            ? 'Credenciais inválidas'
            : 'Erro interno do sistema';

        this.logger.warn(
          `Login failed for: ${loginUserDto.email}, result: ${loginResult}`,
        );

        return {
          success: false,
          message,
          result: loginResult,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to login user: ${loginUserDto.email}`, error);

      return {
        success: false,
        error: error.message,
        result: -1,
      };
    }
  }

  async logoutUser(logoutUserDto: LogoutUserDto): Promise<LogoutResponse> {
    try {
      this.logger.log(`Logout attempt for user: ${logoutUserDto.codUsu}`);

      UserValidator.validateLogoutData(logoutUserDto.codUsu);

      const query = UserQueryBuilder.buildLogoutQuery(logoutUserDto.codUsu);

      this.logger.log('Executing SpLogout');
      this.logger.log('Query:', query);

      const result = await this.databaseService.executeQuery(query);
      this.logger.log('SpLogout raw result:', JSON.stringify(result, null, 2));

      const logoutResult =
        result && result.length > 0 ? result[0].LogoutResult : -1;
      this.logger.log(`SpLogout result: ${logoutResult}`);

      const isSuccess = logoutResult >= 0;

      if (isSuccess) {
        this.logger.log(`Logout successful for user: ${logoutUserDto.codUsu}`);

        return {
          success: true,
          message: 'Logout realizado com sucesso',
          result: logoutResult,
        };
      } else {
        const message =
          logoutResult === 0
            ? 'Usuário não encontrado'
            : 'Erro interno do sistema';

        this.logger.warn(
          `Logout failed for: ${logoutUserDto.codUsu}, result: ${logoutResult}`,
        );

        return {
          success: false,
          message: message,
          result: logoutResult,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to logout user: ${logoutUserDto.codUsu}`,
        error,
      );

      return {
        success: false,
        error: error.message,
        result: -1,
      };
    }
  }

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

      const procedureParams = [
        generatedCodUsu,
        createUserDto.nomeUsu.trim(),
        createUserDto.email.trim().toLowerCase(),
        createUserDto.tel?.trim() || null,
        createUserDto.ramal?.trim() || null,
        createUserDto.cel?.trim() || null,
        createUserDto.senha,
        createUserDto.trocarSenha || 'N',
      ];

      this.logger.log(
        `Executing with generated CodUsu=${generatedCodUsu} and parameters:`,
        procedureParams.map((param, index) =>
          index === 6 ? '[PROTECTED]' : param,
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

      const query = UserQueryBuilder.buildCreateUserQuery(
        createUserDto,
        generatedCodUsu,
      );

      this.logger.log(
        `Executing direct query for user: ${createUserDto.email} with CodUsu: ${generatedCodUsu}`,
      );
      this.logger.log(
        `Query: ${query.replace(createUserDto.senha, '[PROTECTED]')}`,
      );

      const result = await this.databaseService.executeQuery(query);
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
