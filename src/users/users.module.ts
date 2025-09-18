import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { StoredProceduresModule } from '../stored-procedures/stored-procedures.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule, StoredProceduresModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
