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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { LogoutUserDto } from './dto/logout-user.dto';
import { UserCreateResponse } from './interfaces/user.interface';
import { LoginResponse, LogoutResponse } from './interfaces/auth.interface';

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
  ): Promise<LogoutResponse> {
    try {
      this.logger.log(`Logout request for: ${logoutUserDto.codUsu}`);

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

  @Get(':codUsu')
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
