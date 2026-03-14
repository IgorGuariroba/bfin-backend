import type { Response } from 'express';
import type { AuthRequest, JWTPayload } from '../types';

/**
 * Higher-order function para envolver handlers de controller com verificação de autenticação
 * Elimina a necessidade de repetir o check `if (!req.user)` em cada método
 * Garante que req.user esteja definido dentro do handler
 */
export function withAuth(handler: (req: AuthRequestWithUser, res: Response) => Promise<void>) {
  return async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    return handler(req as AuthRequestWithUser, res);
  };
}

/**
 * AuthRequest com user garantido (não undefined)
 */
interface AuthRequestWithUser extends Omit<AuthRequest, 'user'> {
  user: JWTPayload;
}
