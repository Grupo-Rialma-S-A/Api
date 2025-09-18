import { Module } from '@nestjs/common';
import { StoredProceduresController } from './stored-procedures.controller';
import { StoredProceduresService } from './stored-procedures.service';
import { DatabaseModule } from '../database/database.module';
import { DatabaseDiagnosticsService } from '../database/database-diagnostics.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StoredProceduresController],
  providers: [StoredProceduresService, DatabaseDiagnosticsService],
  exports: [StoredProceduresService],
})
export class StoredProceduresModule {}
