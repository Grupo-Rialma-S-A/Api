import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  StoredProcedure,
  StoredProcedureExecutionResult,
} from './interfaces/stored-procedure.interface';

@Injectable()
export class StoredProceduresService {
  private readonly logger = new Logger(StoredProceduresService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async checkStoredProcedureExists(
    procedureName: string,
    schema: string = 'dbo',
  ): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM sys.procedures p
        INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
        WHERE s.name = @0 AND p.name = @1
      `;

      const result = await this.databaseService.executeQuery(query, [
        schema,
        procedureName,
      ]);
      return result[0]?.count > 0;
    } catch (error) {
      this.logger.error(
        `Failed to check stored procedure existence: ${procedureName}`,
        error,
      );
      return false;
    }
  }

  async getAllStoredProcedures(): Promise<StoredProcedure[]> {
    try {
      const query = `
        SELECT 
          s.name as schema_name,
          p.name as procedure_name,
          p.create_date,
          p.modify_date
        FROM sys.procedures p
        INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
        ORDER BY s.name, p.name
      `;

      const result = await this.databaseService.executeQuery(query);
      this.logger.log(`Found ${result.length} stored procedures in database`);
      return result;
    } catch (error) {
      this.logger.error('Failed to list stored procedures', error);
      throw error;
    }
  }

  async executeSpListaProcs(): Promise<any[]> {
    try {
      this.logger.log('Checking if SpListaProcs exists...');

      const exists = await this.checkStoredProcedureExists(
        'SpListaProcs',
        'dbo',
      );

      if (!exists) {
        this.logger.warn('SpListaProcs not found');
        const allProcs = await this.getAllStoredProcedures();

        const similarProcs = allProcs.filter(
          (proc) =>
            proc.procedure_name.toLowerCase().includes('lista') ||
            proc.procedure_name.toLowerCase().includes('proc'),
        );

        if (similarProcs.length > 0) {
          this.logger.log(
            'Found similar procedures:',
            similarProcs.map((p) => `${p.schema_name}.${p.procedure_name}`),
          );
        }

        throw new Error(
          `SpListaProcs not found. Available procedures: ${allProcs.length}. Similar procedures found: ${similarProcs.length}`,
        );
      }

      this.logger.log('SpListaProcs found, executing...');

      const attempts = [
        'EXEC dbo.SpListaProcs',
        'EXEC [dbo].[SpListaProcs]',
        'EXEC SpListaProcs',
      ];

      let result;
      let lastError;

      for (const query of attempts) {
        try {
          this.logger.log(`Attempting: ${query}`);
          result = await this.databaseService.executeQuery(query);
          this.logger.log(`Success with: ${query}`);
          break;
        } catch (error) {
          this.logger.warn(`Failed with ${query}: ${error.message}`);
          lastError = error;
        }
      }

      if (!result) {
        throw lastError;
      }

      this.logger.log(`SpListaProcs returned ${result.length} procedures`);
      return result;
    } catch (error) {
      this.logger.error('Failed to execute SpListaProcs', error);
      throw new Error(`Failed to retrieve stored procedures: ${error.message}`);
    }
  }

  async executeStoredProcedure(
    procedureName: string,
    parameters: Record<string, any> = {},
  ): Promise<StoredProcedureExecutionResult> {
    const startTime = Date.now();

    try {
      const paramString = Object.entries(parameters)
        .map(([key, value]) => {
          if (typeof value === 'string') {
            return `@${key} = '${value}'`;
          }
          return `@${key} = ${value}`;
        })
        .join(', ');

      const query = paramString
        ? `EXEC ${procedureName} ${paramString}`
        : `EXEC ${procedureName}`;

      this.logger.log(`Executing stored procedure: ${query}`);

      const result = await this.databaseService.executeQuery(query);
      const executionTime = Date.now() - startTime;

      this.logger.log(
        `Stored procedure ${procedureName} executed successfully in ${executionTime}ms`,
      );

      return {
        success: true,
        data: result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(
        `Failed to execute stored procedure ${procedureName}`,
        error,
      );

      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  }

  async executeStoredProcedureWithParams(
    procedureName: string,
    parameters: any[] = [],
  ): Promise<StoredProcedureExecutionResult> {
    const startTime = Date.now();

    try {
      const placeholders = parameters.map((_, index) => `@${index}`).join(', ');
      const query = placeholders
        ? `EXEC ${procedureName} ${placeholders}`
        : `EXEC ${procedureName}`;

      this.logger.log(
        `Executing stored procedure with parameters: ${procedureName}`,
      );

      const result = await this.databaseService.executeQuery(query, parameters);
      const executionTime = Date.now() - startTime;

      this.logger.log(
        `Stored procedure ${procedureName} executed successfully in ${executionTime}ms`,
      );

      return {
        success: true,
        data: result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(
        `Failed to execute stored procedure ${procedureName}`,
        error,
      );

      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  }

  async getStoredProceduresByPattern(
    pattern: string,
  ): Promise<StoredProcedure[]> {
    try {
      const allProcedures = await this.getAllStoredProcedures();

      return allProcedures.filter(
        (proc) =>
          proc.procedure_name.toLowerCase().includes(pattern.toLowerCase()) ||
          proc.schema_name.toLowerCase().includes(pattern.toLowerCase()),
      );
    } catch (error) {
      this.logger.error(
        `Failed to search procedures by pattern: ${pattern}`,
        error,
      );
      throw error;
    }
  }
}
