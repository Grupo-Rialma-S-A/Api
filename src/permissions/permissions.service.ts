import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSistemaDto } from './dto/create-sistema.dto';
import { CreateTelaDto } from './dto/create-tela.dto';
import { CreateGrupoUsuarioDto } from './dto/create-grupo-usuario.dto';
import { AuthorizeSistemaDto } from './dto/authorize-sistema.dto';
import { GetPermissionsDto } from './dto/get-permissions.dto';
import { ListGruposDto } from './dto/list-grupos.dto';
import {
  PermissionsResponse,
  UserPermissions,
} from './interfaces/permissions.interface';
import { ListGruposResponse } from './interfaces/grupo.interface';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Cadastra um novo sistema usando SpGrSistema
   */
  async createSistema(
    createSistemaDto: CreateSistemaDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log(`Creating sistema: ${createSistemaDto.codSis}`);

      const query = `
        DECLARE @CodSis char(10) = '${createSistemaDto.codSis.trim().replace(/'/g, "''")}';
        DECLARE @DescrSis varchar(100) = '${createSistemaDto.descrSis.trim().replace(/'/g, "''")}';
        DECLARE @DescrMenu varchar(20) = '${createSistemaDto.descrMenu.trim().replace(/'/g, "''")}';
        
        EXEC SpGrSistema @CodSis, @DescrSis, @DescrMenu
      `;

      const result = await this.databaseService.executeQuery(query, []);

      this.logger.log(
        `Sistema created successfully: ${createSistemaDto.codSis}`,
      );

      return {
        success: true,
        message: 'Sistema cadastrado com sucesso',
        data: {
          codSis: createSistemaDto.codSis,
          descrSis: createSistemaDto.descrSis,
          descrMenu: createSistemaDto.descrMenu,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to create sistema: ${createSistemaDto.codSis}`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cadastra uma nova tela dentro de um sistema usando SpGrTela
   */
  async createTela(createTelaDto: CreateTelaDto): Promise<PermissionsResponse> {
    try {
      this.logger.log(
        `Creating tela: ${createTelaDto.codTela} for sistema: ${createTelaDto.codSis}`,
      );

      const query = `
        DECLARE @CodSis char(10) = '${createTelaDto.codSis.trim().replace(/'/g, "''")}';
        DECLARE @CodTela char(10) = '${createTelaDto.codTela.trim().replace(/'/g, "''")}';
        DECLARE @DescrTela varchar(100) = '${createTelaDto.descrTela.trim().replace(/'/g, "''")}';
        DECLARE @DescrMenu char(20) = '${createTelaDto.descrMenu.trim().replace(/'/g, "''")}';
        DECLARE @LinhaChamada char(20) = '${createTelaDto.linhaChamada.trim().replace(/'/g, "''")}';
        
        EXEC SpGrTela @CodSis, @CodTela, @DescrTela, @DescrMenu, @LinhaChamada
      `;

      const result = await this.databaseService.executeQuery(query, []);

      this.logger.log(`Tela created successfully: ${createTelaDto.codTela}`);

      return {
        success: true,
        message: 'Tela cadastrada com sucesso',
        data: {
          codSis: createTelaDto.codSis,
          codTela: createTelaDto.codTela,
          descrTela: createTelaDto.descrTela,
          descrMenu: createTelaDto.descrMenu,
          linhaChamada: createTelaDto.linhaChamada,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to create tela: ${createTelaDto.codTela}`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cadastra um novo grupo de usuário usando SpGrGrupoUsu
   */
  async createGrupoUsuario(
    createGrupoUsuarioDto: CreateGrupoUsuarioDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log(
        `Creating grupo usuario: ${createGrupoUsuarioDto.codGrupoUsu}`,
      );

      const query = `
        DECLARE @CodGrupoUsu char(10) = '${createGrupoUsuarioDto.codGrupoUsu.trim().replace(/'/g, "''")}';
        DECLARE @DescrGrupoUsu varchar(80) = '${createGrupoUsuarioDto.descrGrupoUsu.trim().replace(/'/g, "''")}';
        
        EXEC SpGrGrupoUsu @CodGrupoUsu, @DescrGrupoUsu
      `;

      const result = await this.databaseService.executeQuery(query, []);

      this.logger.log(
        `Grupo usuario created successfully: ${createGrupoUsuarioDto.codGrupoUsu}`,
      );

      return {
        success: true,
        message: 'Grupo de usuário cadastrado com sucesso',
        data: {
          codGrupoUsu: createGrupoUsuarioDto.codGrupoUsu,
          descrGrupoUsu: createGrupoUsuarioDto.descrGrupoUsu,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to create grupo usuario: ${createGrupoUsuarioDto.codGrupoUsu}`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Autoriza um sistema para um grupo de usuário usando SpGrAutorizado
   */
  async authorizeSistema(
    authorizeSistemaDto: AuthorizeSistemaDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log(
        `Authorizing sistema ${authorizeSistemaDto.codSis} for grupo ${authorizeSistemaDto.codGrupoUsu}`,
      );

      const query = `
        DECLARE @CodGrupoUsu char(10) = '${authorizeSistemaDto.codGrupoUsu.trim().replace(/'/g, "''")}';
        DECLARE @CodSis char(10) = '${authorizeSistemaDto.codSis.trim().replace(/'/g, "''")}';
        DECLARE @CodTela char(10) = '${authorizeSistemaDto.codTela.trim().replace(/'/g, "''")}';
        EXEC SpGrAutorizado @CodGrupoUsu, @CodSis, @CodTela
      `;

      const result = await this.databaseService.executeQuery(query, []);

      this.logger.log(
        `Sistema authorized successfully: ${authorizeSistemaDto.codSis} for grupo: ${authorizeSistemaDto.codGrupoUsu}`,
      );

      return {
        success: true,
        message: 'Sistema autorizado para o grupo com sucesso',
        data: {
          codGrupoUsu: authorizeSistemaDto.codGrupoUsu,
          codSis: authorizeSistemaDto.codSis,
          codTela: authorizeSistemaDto.codTela,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to authorize sistema: ${authorizeSistemaDto.codSis}`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verifica as permissões do usuário usando SpSeAutoSis
   */
  async getUserPermissions(
    getUserPermissionsDto: GetPermissionsDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log(
        `Getting permissions for user: ${getUserPermissionsDto.codUsu}`,
      );

      const query = `
        DECLARE @CodUsu int = ${getUserPermissionsDto.codUsu};
        
        EXEC SpSeAutoSis @CodUsu
      `;

      const result = await this.databaseService.executeQuery(query, []);

      this.logger.log(
        `Permissions retrieved for user: ${getUserPermissionsDto.codUsu}`,
      );

      const userPermissions: UserPermissions = {
        codUsu: getUserPermissionsDto.codUsu,
        sistemas: result || [],
      };

      return {
        success: true,
        message: 'Permissões do usuário obtidas com sucesso',
        data: userPermissions,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get permissions for user: ${getUserPermissionsDto.codUsu}`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Lista todos os grupos do sistema usando SpSeGrupoUsu
   */
  async listGrupos(
    listGruposDto?: ListGruposDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log('Listing grupos');

      const query = `EXEC SpSeGrupoUsu`;

      const result = await this.databaseService.executeQuery(query, []);

      this.logger.log(
        `Groups retrieved successfully. Count: ${result?.length || 0}`,
      );

      // Remove espaços em branco dos campos retornados do banco
      const gruposLimpos =
        result?.map((grupo) => ({
          CodGrupoUsu: grupo.CodGrupoUsu?.trim() || '',
          DescrGrupoUsu: grupo.DescrGrupoUsu?.trim() || '',
        })) || [];

      const listGruposResponse: ListGruposResponse = {
        grupos: gruposLimpos,
      };

      return {
        success: true,
        message: 'Grupos listados com sucesso',
        data: listGruposResponse,
      };
    } catch (error) {
      this.logger.error('Failed to list grupos', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
