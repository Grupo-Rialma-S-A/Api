import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StoredProceduresService } from '../stored-procedures/stored-procedures.service';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserCreateResponse } from './interfaces/user.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly storedProceduresService: StoredProceduresService,
    private readonly databaseService: DatabaseService,
  ) {}

  async getStoredProcedureParameters(procedureName: string): Promise<any[]> {
    try {
      const query = `
        SELECT 
          p.name as parameter_name,
          p.parameter_id,
          t.name as data_type,
          p.max_length,
          p.precision,
          p.scale,
          p.is_output
        FROM sys.procedures pr
        INNER JOIN sys.parameters p ON pr.object_id = p.object_id
        INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
        WHERE pr.name = @0
        ORDER BY p.parameter_id
      `;

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

  private async generateUniqueCodUsu(): Promise<number> {
    try {
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        let codUsu: number;

        if (attempts < 3) {
          const timestamp = Date.now().toString().slice(-6);
          codUsu = parseInt(timestamp);
        } else if (attempts < 6) {
          const countQuery = `SELECT COUNT(*) as Total FROM Usuario`;
          const countResult =
            await this.databaseService.executeQuery(countQuery);
          const total = countResult[0]?.Total || 0;
          const base = total + 1000;
          const random = Math.floor(Math.random() * 1000);
          codUsu = base + random + attempts;
        } else {
          codUsu = Math.floor(Math.random() * 900000) + 100000;
        }

        codUsu = Math.abs(codUsu);
        if (codUsu > 2147483647) {
          codUsu = codUsu % 1000000;
        }

        const exists = await this.getUserExists(codUsu.toString());
        if (!exists) {
          this.logger.log(`Generated unique CodUsu: ${codUsu}`);
          return codUsu;
        }

        attempts++;
        this.logger.warn(
          `CodUsu ${codUsu} already exists, trying again (attempt ${attempts})`,
        );
      }

      throw new Error(
        'Não foi possível gerar um código único para o usuário após várias tentativas',
      );
    } catch (error) {
      this.logger.error('Failed to generate unique CodUsu', error);
      throw new Error(`Falha ao gerar código do usuário: ${error.message}`);
    }
  }

  async createUserWithDirectQuery(
    createUserDto: CreateUserDto,
  ): Promise<UserCreateResponse> {
    try {
      this.logger.log(
        `Creating user with direct query: ${createUserDto.email}`,
      );

      await this.validateUserData(createUserDto);

      const generatedCodUsu = await this.generateUniqueCodUsu();

      const hashedPassword = await this.hashPassword(createUserDto.senha);

      const query = `
      EXEC SpGrUsuario 
        ${generatedCodUsu},
        '${createUserDto.nomeUsu.trim().replace(/'/g, "''")}',
        '${createUserDto.email.trim().toLowerCase()}',
        ${createUserDto.tel ? `'${createUserDto.tel.trim()}'` : 'NULL'},
        ${createUserDto.ramal ? `'${createUserDto.ramal.trim()}'` : 'NULL'},
        ${createUserDto.cel ? `'${createUserDto.cel.trim()}'` : 'NULL'},
        '${hashedPassword.replace(/'/g, "''")}',
        '${createUserDto.trocarSenha || 'N'}'
    `;

      this.logger.log(
        `Executing direct query for user: ${createUserDto.email} with CodUsu: ${generatedCodUsu}`,
      );
      this.logger.log(`Query: ${query}`);

      const result = await this.databaseService.executeQuery(query);

      this.logger.log(`SpGrUsuario result:`, result);

      const response = this.parseStoredProcedureResponse(result);

      const cleanedData = this.cleanUserData({
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

      return {
        success: false,
        error: error.message,
        userId: undefined,
      };
    }
  }

  async createUser(createUserDto: CreateUserDto): Promise<UserCreateResponse> {
    try {
      this.logger.log(`Creating user: ${createUserDto.email}`);

      const generatedCodUsu = await this.generateUniqueCodUsu();

      let parameters;
      try {
        parameters = await this.getStoredProcedureParameters('SpGrUsuario');
        this.logger.log('SpGrUsuario parameters:', parameters);
      } catch (error) {
        this.logger.warn(
          'Could not get procedure parameters, trying direct query approach',
        );
        return await this.createUserWithDirectQuery(createUserDto);
      }

      const procedureParams = [
        generatedCodUsu,
        createUserDto.nomeUsu.trim(),
        createUserDto.email.trim().toLowerCase(),
        createUserDto.tel?.trim() || null,
        createUserDto.ramal?.trim() || null,
        createUserDto.cel?.trim() || null,
        await this.hashPassword(createUserDto.senha),
        createUserDto.trocarSenha || 'N',
      ];

      this.logger.log(
        `Executing with generated CodUsu=${generatedCodUsu} and parameters:`,
        procedureParams,
      );

      const result =
        await this.storedProceduresService.executeStoredProcedureWithParams(
          'SpGrUsuario',
          procedureParams,
        );

      if (result.success) {
        const response = this.parseStoredProcedureResponse(result.data);

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

      this.logger.log('Falling back to direct query approach');
      return await this.createUserWithDirectQuery(createUserDto);
    }
  }

  private async validateUserData(createUserDto: CreateUserDto): Promise<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createUserDto.email)) {
      throw new BadRequestException('Email deve ter um formato válido');
    }

    if (createUserDto.tel && !/^[\d\s\-\(\)\+]+$/.test(createUserDto.tel)) {
      throw new BadRequestException(
        'Telefone deve conter apenas números e caracteres válidos',
      );
    }

    if (createUserDto.cel && !/^[\d\s\-\(\)\+]+$/.test(createUserDto.cel)) {
      throw new BadRequestException(
        'Celular deve conter apenas números e caracteres válidos',
      );
    }
  }

  private async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      this.logger.error('Failed to hash password', error);
      throw new Error('Falha ao processar senha');
    }
  }

  private parseStoredProcedureResponse(data: any): {
    message?: string;
    data?: any;
  } {
    try {
      if (Array.isArray(data) && data.length > 0) {
        const firstResult = data[0];

        if (firstResult.Message || firstResult.message) {
          return {
            message: firstResult.Message || firstResult.message,
            data: firstResult,
          };
        }

        if (
          firstResult.Sucesso !== undefined ||
          firstResult.sucesso !== undefined
        ) {
          const sucesso = firstResult.Sucesso || firstResult.sucesso;
          return {
            message: sucesso
              ? 'Operação realizada com sucesso'
              : 'Falha na operação',
            data: firstResult,
          };
        }

        return { data: firstResult };
      }

      if (data && typeof data === 'object') {
        return {
          message:
            data.Message || data.message || 'Operação realizada com sucesso',
          data: data,
        };
      }

      return { message: 'Usuário processado com sucesso' };
    } catch (error) {
      this.logger.warn('Failed to parse stored procedure response', error);
      return { message: 'Usuário processado com sucesso' };
    }
  }

  async getUserByCode(codUsu: string): Promise<any> {
    try {
      this.logger.log(`Searching for user: ${codUsu}`);

      const query = `
      SELECT 
        CodUsu,
        NomeUsu,
        Email,
        Tel,
        Ramal,
        Cel,
        TrocarSenha,
        DataInc,
        DataAlt,
        DataBloqueado,
        Logado
      FROM Usuario 
      WHERE CodUsu = @0
    `;

      const result = await this.databaseService.executeQuery(query, [
        codUsu.trim(),
      ]);

      if (result && result.length > 0) {
        const cleanedData = this.cleanUserData(result[0]);

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

  async getUserExists(codUsu: string): Promise<boolean> {
    try {
      this.logger.log(`Checking if user exists: ${codUsu}`);

      const query = `
      SELECT COUNT(*) as UserCount
      FROM Usuario 
      WHERE CodUsu = @0
    `;

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

      let query = `
      SELECT 
        CodUsu,
        NomeUsu,
        Email,
        Tel,
        Ramal,
        Cel,
        TrocarSenha,
        DataInc,
        DataAlt,
        DataBloqueado,
        Logado
      FROM Usuario
    `;

      const queryParams: any[] = [];
      let paramIndex = 0;

      if (search && search.trim()) {
        query += ` WHERE (CodUsu LIKE @${paramIndex} OR NomeUsu LIKE @${paramIndex + 1} OR Email LIKE @${paramIndex + 2})`;
        const searchTerm = `%${search.trim()}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
        paramIndex += 3;
      }

      query += ` ORDER BY NomeUsu ASC`;

      if (page && limit) {
        const offset = (page - 1) * limit;
        query += ` OFFSET @${paramIndex} ROWS FETCH NEXT @${paramIndex + 1} ROWS ONLY`;
        queryParams.push(offset, limit);
      }

      this.logger.log(`Executing query: ${query}`);
      this.logger.log(`Query params:`, queryParams);

      const result = await this.databaseService.executeQuery(
        query,
        queryParams,
      );

      let total = 0;

      if (page && limit) {
        let countQuery = `SELECT COUNT(*) as Total FROM Usuario`;
        const countParams: any[] = [];

        if (search && search.trim()) {
          countQuery += ` WHERE (CodUsu LIKE @0 OR NomeUsu LIKE @1 OR Email LIKE @2)`;
          const searchTerm = `%${search.trim()}%`;
          countParams.push(searchTerm, searchTerm, searchTerm);
        }

        const countResult = await this.databaseService.executeQuery(
          countQuery,
          countParams,
        );
        total = countResult[0]?.Total || 0;
      }

      const cleanedData = this.cleanUserData(result || []);

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

  private cleanUserData(userData: any): any {
    if (!userData) return userData;

    if (Array.isArray(userData)) {
      return userData.map((user) => this.cleanUserData(user));
    }

    const cleaned = { ...userData };

    const stringFields = [
      'NomeUsu',
      'Email',
      'Tel',
      'Ramal',
      'Cel',
      'TrocarSenha',
    ];

    stringFields.forEach((field) => {
      if (cleaned[field] && typeof cleaned[field] === 'string') {
        cleaned[field] = cleaned[field].trim();
      }
    });

    return cleaned;
  }
}
