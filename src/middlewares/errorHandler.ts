import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'InsufficientBalanceError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso proibido') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso não encontrado') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorHandler(error: any, _req: Request, res: Response, _next: NextFunction) {
  // Log error safely to avoid util.inspect crashes (common in some Node.js versions with Proxies)
  try {
    if (error instanceof Error) {
      // Log only strings to avoid util.inspect issues
      const name = String(error.name || 'Error');
      const message = String(error.message || 'No message');
      console.error(`Error [${name}]: ${message}`);

      if (error.stack) {
        console.error(String(error.stack));
      }
    } else {
      // If not an Error object, try to convert to string safely
      try {
        console.error('Non-Error object thrown:', String(error));
      } catch (_innerError) {
        console.error('Non-Error object thrown (could not be converted to string)');
      }
    }
  } catch (_logError) {
    // If we're here, even basic logging failed. Try one last time with a literal string.
    try {
      console.error('Failed to log original error safely');
    } catch (_e) {
      // Ignore
    }
  }

  // AppError (erros customizados)
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.name,
      message: error.message,
    });
  }

  const rateLimitStatus =
    (error as { status?: number; statusCode?: number }).status ??
    (error as { statusCode?: number }).statusCode;
  if (rateLimitStatus === 429) {
    return res.status(429).json({
      error: 'RateLimitError',
      message: error.message || 'Muitas requisições',
    });
  }

  if (error instanceof SyntaxError && error.message.toLowerCase().includes('json')) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Payload JSON inválido',
    });
  }

  // Zod validation error
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Falha na validação',
      details: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'ConflictError',
        message: 'Já existe um registro com este valor',
        field: (error.meta?.target as string[])?.join(', '),
      });
    }

    // Record not found
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'NotFoundError',
        message: 'Registro não encontrado',
      });
    }

    // Foreign key constraint violation
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Referência inválida a registro relacionado',
      });
    }
  }

  // Prisma validation error
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Dados inválidos fornecidos',
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Token inválido',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Token expirado',
    });
  }

  // Default error (500)
  return res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'Ocorreu um erro inesperado' : error.message,
  });
}
