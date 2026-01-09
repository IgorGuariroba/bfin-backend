import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

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
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', error);

  // AppError (erros customizados)
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.name,
      message: error.message,
    });
  }

  // Zod validation error
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Validation failed',
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
        message: 'A record with this value already exists',
        field: (error.meta?.target as string[])?.join(', '),
      });
    }

    // Record not found
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'NotFoundError',
        message: 'Record not found',
      });
    }

    // Foreign key constraint violation
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid reference to related record',
      });
    }
  }

  // Prisma validation error
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid data provided',
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Invalid token',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Token expired',
    });
  }

  // Default error (500)
  return res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message,
  });
}
