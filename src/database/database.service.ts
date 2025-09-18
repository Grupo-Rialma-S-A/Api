import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    await this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      await this.dataSource.query('SELECT 1 as test');
      this.logger.log('Database connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', error);
      return false;
    }
  }

  async getConnectionStatus(): Promise<{
    isConnected: boolean;
    database: string | undefined;
    host: string | undefined;
  }> {
    const options = this.dataSource?.options;

    return {
      isConnected: this.dataSource?.isInitialized || false,
      database: options?.database ? String(options.database) : undefined,
      host: 'host' in options ? (options as any).host : undefined,
    };
  }

  async executeQuery(query: string, parameters?: any[]): Promise<any> {
    try {
      return await this.dataSource.query(query, parameters);
    } catch (error) {
      this.logger.error(`Query execution failed: ${query}`, error);
      throw error;
    }
  }

  async getCurrentDatabaseInfo(): Promise<any> {
    try {
      const query = `
        SELECT 
          DB_NAME() as current_database,
          @@SERVERNAME as server_name,
          SYSTEM_USER as [user_name],
          SUSER_NAME() as login_name
      `;

      const result = await this.dataSource.query(query);
      return result[0];
    } catch (error) {
      this.logger.error('Failed to get database info', error);
      throw error;
    }
  }
}
