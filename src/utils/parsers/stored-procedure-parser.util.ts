import { Logger } from '@nestjs/common';

export class StoredProcedureResponseParser {
  private static readonly logger = new Logger(
    StoredProcedureResponseParser.name,
  );

  static parseResponse(data: any): { message?: string; data?: any } {
    try {
      if (Array.isArray(data) && data.length > 0) {
        const firstResult = data[0];

        if (firstResult.Message || firstResult.message) {
          return {
            message: firstResult.Message || firstResult.message,
            data: firstResult,
          };
        }

        if (
          firstResult.Sucesso !== undefined ||
          firstResult.sucesso !== undefined
        ) {
          const sucesso = firstResult.Sucesso || firstResult.sucesso;
          return {
            message: sucesso
              ? 'Operação realizada com sucesso'
              : 'Falha na operação',
            data: firstResult,
          };
        }

        return { data: firstResult };
      }

      if (data && typeof data === 'object') {
        return {
          message:
            data.Message || data.message || 'Operação realizada com sucesso',
          data: data,
        };
      }

      return { message: 'Usuário processado com sucesso' };
    } catch (error) {
      this.logger.warn('Failed to parse stored procedure response', error);
      return { message: 'Usuário processado com sucesso' };
    }
  }
}
