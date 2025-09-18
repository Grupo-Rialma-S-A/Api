// @ts-nocheck
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

  async getStoredProcedureCode(procedureName: string): Promise<any> {
    try {
      this.logger.log(`Getting code for procedure: ${procedureName}`);

      const query1 = `
        SELECT 
          p.name AS ProcedureName,
          OBJECT_DEFINITION(p.object_id) AS ProcedureCode,
          p.create_date,
          p.modify_date,
          p.type_desc
        FROM sys.procedures p
        WHERE p.name = @0
      `;

      const result1 = await this.databaseService.executeQuery(query1, [
        procedureName,
      ]);
      this.logger.log('OBJECT_DEFINITION result:', result1);

      if (result1 && result1.length > 0 && result1[0].ProcedureCode === null) {
        this.logger.warn(
          'OBJECT_DEFINITION returned null, trying sys.sql_modules',
        );

        const query2 = `
          SELECT 
            p.name AS ProcedureName,
            m.definition AS ProcedureCode,
            p.create_date,
            p.modify_date,
            p.type_desc,
            m.uses_ansi_nulls,
            m.uses_quoted_identifier
          FROM sys.procedures p
          INNER JOIN sys.sql_modules m ON p.object_id = m.object_id
          WHERE p.name = @0
        `;

        const result2 = await this.databaseService.executeQuery(query2, [
          procedureName,
        ]);
        this.logger.log('sys.sql_modules result:', result2);

        if (result2 && result2.length > 0 && result2[0].ProcedureCode) {
          return {
            success: true,
            data: result2[0],
            message: `Código da procedure ${procedureName} encontrado via sys.sql_modules`,
            method: 'sys.sql_modules',
          };
        }
      }

      if (result1 && result1.length > 0) {
        if (result1[0].ProcedureCode) {
          return {
            success: true,
            data: result1[0],
            message: `Código da procedure ${procedureName} encontrado`,
            method: 'OBJECT_DEFINITION',
          };
        } else {
          this.logger.warn(
            `Procedure ${procedureName} exists but code is inaccessible`,
          );

          const permQuery = `
            SELECT 
              p.name AS ProcedureName,
              'Procedure exists but code is not accessible. Possible reasons:' AS Issue,
              '1. Insufficient permissions' AS Reason1,
              '2. Procedure is encrypted' AS Reason2,
              '3. Procedure is in different schema' AS Reason3,
              SCHEMA_NAME(p.schema_id) AS SchemaName,
              p.create_date,
              p.modify_date
            FROM sys.procedures p
            WHERE p.name = @0
          `;

          const permResult = await this.databaseService.executeQuery(
            permQuery,
            [procedureName],
          );

          return {
            success: false,
            data: permResult[0] || result1[0],
            message: `Procedure ${procedureName} existe mas o código não está acessível`,
            issue: 'CODE_INACCESSIBLE',
            possibleReasons: [
              'Permissões insuficientes',
              'Procedure pode estar encriptada',
              'Problema de schema ou contexto de segurança',
            ],
          };
        }
      } else {
        this.logger.log(`Procedure ${procedureName} not found`);

        const similarQuery = `
          SELECT name AS SimilarProcedures, SCHEMA_NAME(schema_id) AS SchemaName
          FROM sys.procedures 
          WHERE name LIKE '%' + @0 + '%' OR name LIKE '%Login%'
        `;

        const similarResult = await this.databaseService.executeQuery(
          similarQuery,
          [procedureName.replace('Sp', '')],
        );

        return {
          success: false,
          data: null,
          message: `Procedure ${procedureName} não encontrada`,
          similar: similarResult,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get procedure code: ${procedureName}`,
        error,
      );
      throw new Error(`Falha ao buscar código da procedure: ${error.message}`);
    }
  }

  async diagnoseProcedureAccess(procedureName: string): Promise<any> {
    try {
      this.logger.log(`Diagnosing procedure access for: ${procedureName}`);

      const diagnostics = [];

      try {
        const existsQuery = `
          SELECT 
            name,
            object_id,
            schema_id,
            SCHEMA_NAME(schema_id) AS schema_name,
            create_date,
            modify_date,
            type_desc,
            is_published,
            is_schema_published
          FROM sys.procedures 
          WHERE name = @0
        `;

        const existsResult = await this.databaseService.executeQuery(
          existsQuery,
          [procedureName],
        );
        diagnostics.push({
          test: 'EXISTS_CHECK',
          success: true,
          result: existsResult,
          message:
            existsResult.length > 0
              ? 'Procedure encontrada'
              : 'Procedure não encontrada',
        });
      } catch (error) {
        diagnostics.push({
          test: 'EXISTS_CHECK',
          success: false,
          error: error.message,
        });
      }

      try {
        const schemaQuery = `
          SELECT 
            SCHEMA_NAME(schema_id) + '.' + name AS FullName,
            OBJECT_DEFINITION(object_id) AS CodeViaSchema
          FROM sys.procedures 
          WHERE name = @0
        `;

        const schemaResult = await this.databaseService.executeQuery(
          schemaQuery,
          [procedureName],
        );
        diagnostics.push({
          test: 'SCHEMA_ACCESS',
          success: true,
          result: schemaResult,
        });
      } catch (error) {
        diagnostics.push({
          test: 'SCHEMA_ACCESS',
          success: false,
          error: error.message,
        });
      }

      try {
        const modulesQuery = `
          SELECT 
            p.name,
            LEN(m.definition) AS DefinitionLength,
            CASE WHEN m.definition IS NULL THEN 'NULL' ELSE 'HAS_CONTENT' END AS DefinitionStatus,
            m.uses_ansi_nulls,
            m.uses_quoted_identifier,
            m.is_schema_bound
          FROM sys.procedures p
          LEFT JOIN sys.sql_modules m ON p.object_id = m.object_id
          WHERE p.name = @0
        `;

        const modulesResult = await this.databaseService.executeQuery(
          modulesQuery,
          [procedureName],
        );
        diagnostics.push({
          test: 'MODULES_CHECK',
          success: true,
          result: modulesResult,
        });
      } catch (error) {
        diagnostics.push({
          test: 'MODULES_CHECK',
          success: false,
          error: error.message,
        });
      }

      try {
        const permQuery = `
          SELECT 
            USER_NAME() AS CurrentUser,
            IS_SRVROLEMEMBER('sysadmin') AS IsSysAdmin,
            IS_MEMBER('db_owner') AS IsDbOwner,
            HAS_PERMS_BY_NAME(@0, 'OBJECT', 'VIEW DEFINITION') AS HasViewDefinition
        `;

        const permResult = await this.databaseService.executeQuery(permQuery, [
          procedureName,
        ]);
        diagnostics.push({
          test: 'PERMISSIONS_CHECK',
          success: true,
          result: permResult,
        });
      } catch (error) {
        diagnostics.push({
          test: 'PERMISSIONS_CHECK',
          success: false,
          error: error.message,
        });
      }

      return {
        success: true,
        diagnostics: diagnostics,
        summary: 'Diagnóstico completo - verifique os resultados',
      };
    } catch (error) {
      this.logger.error(
        `Failed to diagnose procedure: ${procedureName}`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
