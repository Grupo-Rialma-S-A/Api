import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

import { StoredProceduresModule } from './stored-procedures/stored-procedures.module';
import { UsersModule } from './users/users.module';
import { DatabaseService } from './database/database.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    DatabaseModule,
    StoredProceduresModule,
    UsersModule,
  ],
  controllers: [],
  providers: [DatabaseService],
})
export class AppModule {}
