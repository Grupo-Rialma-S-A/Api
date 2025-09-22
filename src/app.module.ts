import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

import { StoredProceduresModule } from './stored-procedures/stored-procedures.module';
import { UsersModule } from './users/users.module';
import { DatabaseService } from './database/database.service';
import { PermissionsModule } from './permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    DatabaseModule,
    StoredProceduresModule,
    UsersModule,
    PermissionsModule,
  ],
  controllers: [],
  providers: [DatabaseService],
})
export class AppModule {}
