import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/AuthService';
import { UnauthorizedError } from './errorHandler';

const authService = new AuthService();

/**
 * Middleware de autenticação JWT
 * Valida o token e adiciona user ao request
 */
export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    // Buscar token do header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('No token provided');
    }

    // Formato esperado: "Bearer TOKEN"
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('Invalid token format. Use: Bearer TOKEN');
    }

    const token = parts[1];

    // Verificar token
    const payload = authService.verifyToken(token);

    // Adicionar user ao request
    req.user = payload;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
}

/**
 * Middleware opcional de autenticação
 * Adiciona user ao request se houver token válido, mas não rejeita se não houver
 */
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');

      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const payload = authService.verifyToken(token);
        req.user = payload;
      }
    }

    next();
  } catch (error) {
    // Ignorar erros de token inválido no modo opcional
    next();
  }
}
