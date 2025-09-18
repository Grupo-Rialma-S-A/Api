import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { StoredProceduresService } from '../stored-procedures/stored-procedures.service';

@Injectable()
export class DatabaseDiagnosticsService {
  private readonly logger = new Logger(DatabaseDiagnosticsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storedProceduresService: StoredProceduresService,
  ) {}

  async getFullDiagnostics(): Promise<any> {
    try {
      const connectionStatus = await this.databaseService.getConnectionStatus();
      const isConnected = await this.databaseService.testConnection();
      const dbInfo = await this.databaseService.getCurrentDatabaseInfo();
      const allProcedures =
        await this.storedProceduresService.getAllStoredProcedures();
      const spListaProcsExists =
        await this.storedProceduresService.checkStoredProcedureExists(
          'SpListaProcs',
        );

      const spListaProcMatches = allProcedures.filter(
        (p) =>
          p.procedure_name.toLowerCase().includes('splistaprocs') ||
          p.procedure_name.toLowerCase().includes('lista') ||
          p.procedure_name.toLowerCase().includes('proc'),
      );

      return {
        success: true,
        data: {
          connection: {
            ...connectionStatus,
            isConnected,
          },
          databaseInfo: dbInfo,
          spListaProcsExists,
          totalProcedures: allProcedures.length,
          procedures: allProcedures.slice(0, 20),
          spListaProcMatches,
        },
      };
    } catch (error) {
      this.logger.error('Full diagnostics failed', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }
}
