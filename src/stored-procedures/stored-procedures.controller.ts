import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { StoredProceduresService } from './stored-procedures.service';
import { DatabaseService } from '../database/database.service';
import { DatabaseDiagnosticsService } from '../database/database-diagnostics.service';
import { StoredProcedure } from './interfaces/stored-procedure.interface';

@Controller('stored-procedures')
export class StoredProceduresController {
  private readonly logger = new Logger(StoredProceduresController.name);

  constructor(
    private readonly storedProceduresService: StoredProceduresService,
    private readonly databaseService: DatabaseService,
    private readonly diagnosticsService: DatabaseDiagnosticsService,
  ) {}

  @Get('splistaprocs')
  async executeSpListaProcs(): Promise<{
    success: boolean;
    data: any[];
    count: number;
  }> {
    try {
      const procedures =
        await this.storedProceduresService.executeSpListaProcs();

      return {
        success: true,
        data: procedures,
        count: procedures.length,
      };
    } catch (error) {
      this.logger.error('Failed to execute SpListaProcs', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to execute SpListaProcs',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('all')
  async getAllProcedures(): Promise<{
    success: boolean;
    data: StoredProcedure[];
    count: number;
  }> {
    try {
      const procedures =
        await this.storedProceduresService.getAllStoredProcedures();

      return {
        success: true,
        data: procedures,
        count: procedures.length,
      };
    } catch (error) {
      this.logger.error('Failed to get all procedures', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve all procedures',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('search/:pattern')
  async searchProcedures(@Param('pattern') pattern: string): Promise<{
    success: boolean;
    data: StoredProcedure[];
    count: number;
    pattern: string;
  }> {
    try {
      const procedures =
        await this.storedProceduresService.getStoredProceduresByPattern(
          pattern,
        );

      return {
        success: true,
        data: procedures,
        count: procedures.length,
        pattern,
      };
    } catch (error) {
      this.logger.error(
        `Failed to search procedures with pattern: ${pattern}`,
        error,
      );
      throw new HttpException(
        {
          success: false,
          message: 'Failed to search procedures',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('execute')
  async executeStoredProcedure(
    @Body() body: { procedureName: string; parameters?: Record<string, any> },
  ) {
    try {
      const { procedureName, parameters = {} } = body;

      if (!procedureName) {
        throw new HttpException(
          {
            success: false,
            message: 'Procedure name is required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.storedProceduresService.executeStoredProcedure(
        procedureName,
        parameters,
      );

      return result;
    } catch (error) {
      this.logger.error('Failed to execute stored procedure', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to execute stored procedure',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('connection-status')
  async getConnectionStatus() {
    try {
      const status = await this.databaseService.getConnectionStatus();
      const isConnected = await this.databaseService.testConnection();

      return {
        success: true,
        data: {
          ...status,
          isConnected,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get connection status', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get connection status',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('debug')
  async debugDatabase() {
    return this.diagnosticsService.getFullDiagnostics();
  }

  @Get('exists/:procedureName')
  async checkProcedureExists(
    @Param('procedureName') procedureName: string,
    @Param('schema') schema: string = 'dbo',
  ): Promise<{
    success: boolean;
    exists: boolean;
    procedureName: string;
    schema: string;
  }> {
    try {
      const exists =
        await this.storedProceduresService.checkStoredProcedureExists(
          procedureName,
          schema,
        );

      return {
        success: true,
        exists,
        procedureName,
        schema,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check procedure existence: ${procedureName}`,
        error,
      );
      throw new HttpException(
        {
          success: false,
          message: 'Failed to check procedure existence',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sp-code/:procedureName')
  async getStoredProcedureCode(
    @Param('procedureName') procedureName: string,
  ): Promise<any> {
    try {
      this.logger.log(`Getting SP code for: ${procedureName}`);

      const result =
        await this.storedProceduresService.getStoredProcedureCode(
          procedureName,
        );

      return result;
    } catch (error) {
      this.logger.error(`Failed to get SP code: ${procedureName}`, error);

      throw new HttpException(
        {
          success: false,
          message: 'Erro ao buscar código da stored procedure',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sp-diagnose/:procedureName')
  async diagnoseProcedure(
    @Param('procedureName') procedureName: string,
  ): Promise<any> {
    try {
      this.logger.log(`Diagnosing SP: ${procedureName}`);

      const result =
        await this.storedProceduresService.diagnoseProcedureAccess(
          procedureName,
        );

      return result;
    } catch (error) {
      this.logger.error(`Failed to diagnose SP: ${procedureName}`, error);

      throw new HttpException(
        {
          success: false,
          message: 'Erro ao diagnosticar stored procedure',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
