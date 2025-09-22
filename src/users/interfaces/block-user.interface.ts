// src/users/interfaces/block-user.interface.ts
export interface BlockUserResponse {
  success: boolean;
  message: string;
  result?: any;
  error?: string;
  executionTime?: string;
}
