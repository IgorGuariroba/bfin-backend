import { Request } from 'express';

// Tipos de autenticação
export interface JWTPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export interface RegisterDTO {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

// Tipos de contas
export interface CreateAccountDTO {
  account_name: string;
  account_type?: string;
  is_default?: boolean;
}

export interface UpdateAccountDTO {
  account_name?: string;
  is_default?: boolean;
}
