// users.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

import { DatabaseModule } from '../database/database.module';
import { StoredProceduresModule } from '../stored-procedures/stored-procedures.module';
import { TokenService } from 'src/token/token.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // Configuração padrão para access token
        secret:
          configService.get<string>('JWT_ACCESS_SECRET') || 'access-secret-key',
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    StoredProceduresModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, TokenService, JwtAuthGuard],
  exports: [UsersService, TokenService, JwtAuthGuard],
})
export class UsersModule {}
