export interface LoginResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  executionTime?: number;
  result?: number; // O integer retornado pela SP
}

export interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: string;
  executionTime?: number;
  result?: number; // O integer retornado pela SP
}
