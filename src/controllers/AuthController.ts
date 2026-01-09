import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthRequest } from '../types';
import { z } from 'zod';

const authService = new AuthService();

// Schemas de validação
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response) {
    // Validar dados
    const data = registerSchema.parse(req.body);

    // Registrar usuário
    const result = await authService.register(data);

    res.status(201).json(result);
  }

  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response) {
    // Validar dados
    const data = loginSchema.parse(req.body);

    // Autenticar
    const result = await authService.login(data);

    res.json(result);
  }

  /**
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response) {
    // Validar dados
    const data = refreshSchema.parse(req.body);

    // Renovar token
    const result = await authService.refreshToken(data.refresh_token);

    res.json(result);
  }

  /**
   * GET /api/v1/auth/me
   * Requer autenticação
   */
  async me(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await authService.me(req.user.userId);

    res.json(user);
  }
}
