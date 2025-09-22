import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Logger,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreateSistemaDto } from './dto/create-sistema.dto';
import { CreateTelaDto } from './dto/create-tela.dto';
import { CreateGrupoUsuarioDto } from './dto/create-grupo-usuario.dto';
import { AuthorizeSistemaDto } from './dto/authorize-sistema.dto';
import { ListGruposDto } from './dto/list-grupos.dto';
import { PermissionsResponse } from './interfaces/permissions.interface';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  private readonly logger = new Logger(PermissionsController.name);

  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * POST /permissions/sistema
   * Cadastra um novo sistema
   */
  @Post('sistema')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createSistema(
    @Body() createSistemaDto: CreateSistemaDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log(`Create sistema request: ${createSistemaDto.codSis}`);

      const result =
        await this.permissionsService.createSistema(createSistemaDto);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: 'Falha ao cadastrar sistema',
            error: result.error,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to create sistema', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao cadastrar sistema',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /permissions/tela
   * Cadastra uma nova tela dentro de um sistema
   */
  @Post('tela')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createTela(
    @Body() createTelaDto: CreateTelaDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log(
        `Create tela request: ${createTelaDto.codTela} for sistema: ${createTelaDto.codSis}`,
      );

      const result = await this.permissionsService.createTela(createTelaDto);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: 'Falha ao cadastrar tela',
            error: result.error,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to create tela', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao cadastrar tela',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /permissions/grupo-usuario
   * Cadastra um novo grupo de usuário
   */
  @Post('grupo-usuario')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createGrupoUsuario(
    @Body() createGrupoUsuarioDto: CreateGrupoUsuarioDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log(
        `Create grupo usuario request: ${createGrupoUsuarioDto.codGrupoUsu}`,
      );

      const result = await this.permissionsService.createGrupoUsuario(
        createGrupoUsuarioDto,
      );

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: 'Falha ao cadastrar grupo de usuário',
            error: result.error,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to create grupo usuario', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao cadastrar grupo de usuário',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /permissions/authorize
   * Autoriza um sistema para um grupo de usuário
   */
  @Post('authorize')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async authorizeSistema(
    @Body() authorizeSistemaDto: AuthorizeSistemaDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log(
        `Authorize sistema request: ${authorizeSistemaDto.codSis} for grupo: ${authorizeSistemaDto.codGrupoUsu}`,
      );

      const result =
        await this.permissionsService.authorizeSistema(authorizeSistemaDto);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: 'Falha ao autorizar sistema',
            error: result.error,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to authorize sistema', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao autorizar sistema',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /permissions/user/:codUsu
   * Verifica as permissões de um usuário
   */
  @Get('user/:codUsu')
  async getUserPermissions(
    @Param('codUsu') codUsu: string,
  ): Promise<PermissionsResponse> {
    try {
      const codUsuNumber = parseInt(codUsu, 10);

      if (isNaN(codUsuNumber)) {
        throw new HttpException(
          {
            success: false,
            message: 'CodUsu deve ser um número válido',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Get permissions request for user: ${codUsuNumber}`);

      const result = await this.permissionsService.getUserPermissions({
        codUsu: codUsuNumber,
      });

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: 'Falha ao obter permissões do usuário',
            error: result.error,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get user permissions', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao obter permissões',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /permissions/grupos
   * Lista todos os grupos do sistema
   */
  @Get('grupos')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async listGrupos(
    @Query() listGruposDto?: ListGruposDto,
  ): Promise<PermissionsResponse> {
    try {
      this.logger.log('List grupos request');

      const result = await this.permissionsService.listGrupos(listGruposDto);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: 'Falha ao listar grupos',
            error: result.error,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to list grupos', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao listar grupos',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
