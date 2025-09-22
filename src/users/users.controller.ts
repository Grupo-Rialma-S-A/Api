import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  Get,
  Param,
  ValidationPipe,
  UsePipes,
  Query,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { LogoutUserDto } from './dto/logout-user.dto';

import { UserCreateResponse } from './interfaces/user.interface';
import {
  LoginResponse,
  LogoutResponse,
  // RefreshTokenResponse,
} from './interfaces/auth.interface';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RefreshTokenDto } from 'src/token/dto/refresh-token.dto';
import { BlockUserResponse } from './interfaces/block-user.interface';
import { BlockUserDto } from './dto/block-user.dto';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserCreateResponse> {
    try {
      this.logger.log(`Creating user request: ${createUserDto.email}`);

      const result = await this.usersService.createUser(createUserDto);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: 'Falha ao criar usuário',
            error: result.error,
            userId: result.userId,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to create user in controller', error);

      if (error instanceof BadRequestException) {
        throw new HttpException(
          {
            success: false,
            message: error.message,
            error: 'Validation failed',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao criar usuário',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async loginUser(@Body() loginUserDto: LoginUserDto): Promise<LoginResponse> {
    try {
      this.logger.log(`Login request for: ${loginUserDto.email}`);

      const result = await this.usersService.loginUser(loginUserDto);

      this.logger.log(`Login result for ${loginUserDto.email}:`, {
        success: result.success,
        result: result.result,
        message: result.message,
        hasTokens: !!result.tokens,
      });

      if (!result.success) {
        const statusCode =
          result.result === 0
            ? HttpStatus.UNAUTHORIZED
            : HttpStatus.BAD_REQUEST;

        this.logger.warn(
          `Login failed for ${loginUserDto.email}: ${result.message} (result: ${result.result})`,
        );

        throw new HttpException(
          {
            success: false,
            message: result.error || result.message || 'Falha no login',
            result: result.result,
          },
          statusCode,
        );
      }

      this.logger.log(`Login successful for: ${loginUserDto.email}`, {
        success: result.success,
        result: result.result,
        message: result.message,
        userData: result.data,
        tokenType: result.tokens?.tokenType,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to login user: ${loginUserDto.email}`,
        error.stack || error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor no login',
          error: error.message,
          result: -1,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('logout')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async logoutUser(
    @Body() logoutUserDto: LogoutUserDto,
    @Request() req: any,
  ): Promise<LogoutResponse> {
    try {
      this.logger.log(`Logout request for: ${logoutUserDto.codUsu}`);

      // Verifica se o usuário logado pode fazer logout apenas de si mesmo
      // if (req.user.codUsu !== logoutUserDto.codUsu) {
      //   throw new HttpException(
      //     {
      //       success: false,
      //       message: 'Você só pode fazer logout da sua própria conta',
      //       result: -1,
      //     },
      //     HttpStatus.FORBIDDEN,
      //   );
      // }

      const result = await this.usersService.logoutUser(logoutUserDto);

      if (!result.success) {
        const statusCode =
          result.result === 0 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;

        this.logger.warn(
          `Logout failed for ${logoutUserDto.codUsu}: ${result.message} (result: ${result.result})`,
        );

        throw new HttpException(
          {
            success: false,
            message: result.error || result.message || 'Falha no logout',
            result: result.result,
          },
          statusCode,
        );
      }

      this.logger.log(`Logout successful for: ${logoutUserDto.codUsu}`, {
        success: result.success,
        result: result.result,
        message: result.message,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to logout user: ${logoutUserDto.codUsu}`,
        error.stack || error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor no logout',
          error: error.message,
          result: -1,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refresh-token')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<any> {
    try {
      this.logger.log(
        `Refresh token request received for user: ${refreshTokenDto.codUser}`,
      );

      const result = await this.usersService.refreshTokens(refreshTokenDto);

      if (!result.success) {
        this.logger.warn(
          `Token refresh failed for user: ${refreshTokenDto.codUser}: ${result.error}`,
        );

        // Se logout é necessário, retorna status UNAUTHORIZED
        const statusCode = result.logout
          ? HttpStatus.UNAUTHORIZED
          : HttpStatus.BAD_REQUEST;

        throw new HttpException(
          {
            success: false,
            message: result.error || 'Falha ao atualizar token',
            logout: result.logout,
          },
          statusCode,
        );
      }

      this.logger.log(
        `Token refresh successful for user: ${refreshTokenDto.codUser}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to refresh token for user: ${refreshTokenDto.codUser}`,
        error.stack || error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao atualizar token',
          error: error.message,
          logout: true, // Força logout em erros inesperados
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getUserProfile(@Request() req: any): Promise<{
    success: boolean;
    data?: any;
    message: string;
  }> {
    try {
      this.logger.log(`Getting profile for user: ${req.user.codUsu}`);

      const result = await this.usersService.getUserByCode(
        req.user.codUsu.toString(),
      );

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: result.message,
            data: null,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get profile for user: ${req.user?.codUsu}`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao buscar perfil',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('block')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async blockUser(
    @Body() blockUserDto: BlockUserDto,
    @Request() req: any,
  ): Promise<BlockUserResponse> {
    try {
      this.logger.log(
        `Block user request for: ${blockUserDto.codUsu} by user: ${req.user.codUsu}`,
      );

      // Opcional: Verifica se o usuário logado tem permissão para bloquear
      // Você pode implementar verificação de roles/permissões aqui
      // if (!this.hasPermissionToBlockUsers(req.user)) {
      //   throw new HttpException(
      //     {
      //       success: false,
      //       message: 'Você não tem permissão para bloquear usuários',
      //     },
      //     HttpStatus.FORBIDDEN,
      //   );
      // }

      // Impede que o usuário bloqueie a si mesmo
      if (req.user.codUsu === blockUserDto.codUsu) {
        this.logger.warn(`User ${req.user.codUsu} tried to block themselves`);
        throw new HttpException(
          {
            success: false,
            message: 'Você não pode bloquear sua própria conta',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.usersService.blockUser(blockUserDto);

      if (!result.success) {
        const statusCode = result.message.includes('não encontrado')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

        this.logger.warn(
          `Block user failed for ${blockUserDto.codUsu}: ${result.message}`,
        );

        throw new HttpException(
          {
            success: false,
            message:
              result.error || result.message || 'Falha ao bloquear usuário',
          },
          statusCode,
        );
      }

      this.logger.log(
        `User blocked successfully: ${blockUserDto.codUsu} by user: ${req.user.codUsu}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to block user: ${blockUserDto.codUsu}`,
        error.stack || error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao bloquear usuário',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':codUsu')
  @UseGuards(JwtAuthGuard)
  async getUserByCode(@Param('codUsu') codUsu: string): Promise<{
    success: boolean;
    data?: any;
    message: string;
  }> {
    try {
      this.logger.log(`Getting user: ${codUsu}`);

      const result = await this.usersService.getUserByCode(codUsu);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: result.message,
            data: null,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get user: ${codUsu}`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao buscar usuário',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  // @UseGuards(JwtAuthGuard)
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<{
    success: boolean;
    data: any[];
    total?: number;
    page?: number;
    limit?: number;
    message: string;
  }> {
    try {
      this.logger.log('Getting all users request');

      const pageNumber = page ? parseInt(page, 10) : 1;
      const limitNumber = limit ? parseInt(limit, 10) : 30;

      if (page && (isNaN(pageNumber) || pageNumber < 1)) {
        throw new HttpException(
          {
            success: false,
            message: 'Parâmetro "page" deve ser um número maior que 0',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        limit &&
        (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100)
      ) {
        throw new HttpException(
          {
            success: false,
            message: 'Parâmetro "limit" deve ser um número entre 1 e 100',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.usersService.getAllUsers(
        pageNumber,
        limitNumber,
        search,
      );

      return result;
    } catch (error) {
      this.logger.error('Failed to get all users in controller', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Erro interno do servidor ao buscar usuários',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
