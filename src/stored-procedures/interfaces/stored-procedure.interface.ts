export interface StoredProcedure {
  schema_name: string;
  procedure_name: string;
  create_date: Date;
  modify_date: Date;
}

export interface StoredProcedureExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
}
