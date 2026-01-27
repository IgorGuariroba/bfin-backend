import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client';
import {
  AppError,
  ValidationError,
  NotFoundError,
  errorHandler,
} from '../../middlewares/errorHandler';

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  statusCode?: number;
  body?: unknown;
};

function createMockResponse(): MockResponse {
  const res = {} as MockResponse;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  return res;
}

function callHandler(error: Error) {
  const req = {} as Request;
  const res = createMockResponse();
  const next = vi.fn() as unknown as NextFunction;
  errorHandler(error, req, res, next);
  return res;
}

function createKnownPrismaError(
  code: string,
  meta?: Record<string, unknown>
): Prisma.PrismaClientKnownRequestError {
  const err = Object.create(
    Prisma.PrismaClientKnownRequestError.prototype
  ) as Prisma.PrismaClientKnownRequestError;
  err.code = code;
  err.meta = meta;
  err.message = `Prisma error ${code}`;
  err.name = 'PrismaClientKnownRequestError';
  return err;
}

function createValidationPrismaError(): Prisma.PrismaClientValidationError {
  const err = Object.create(
    Prisma.PrismaClientValidationError.prototype
  ) as Prisma.PrismaClientValidationError;
  err.message = 'Prisma validation error';
  err.name = 'PrismaClientValidationError';
  return err;
}

describe('errorHandler (unit)', () => {
  const originalEnv = process.env.NODE_ENV;
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('maps AppError instances to their status code and shape', () => {
    const res = callHandler(new ValidationError('Invalid input'));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      error: 'ValidationError',
      message: 'Invalid input',
    });
  });

  it('handles rate limit style errors with status/statusCode 429', () => {
    const err = new Error('Too many requests') as Error & { status?: number };
    err.status = 429;

    const res = callHandler(err);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.body).toEqual({
      error: 'RateLimitError',
      message: 'Too many requests',
    });
  });

  it('returns Invalid JSON payload for JSON SyntaxError', () => {
    const res = callHandler(new SyntaxError('Unexpected token in JSON'));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({
      error: 'ValidationError',
      message: 'Invalid JSON payload',
    });
  });

  it('formats ZodError details', () => {
    const schema = z.object({
      amount: z.number().positive(),
    });

    let zodError: ZodError;
    try {
      schema.parse({ amount: -1 });
      throw new Error('Expected Zod parse to fail');
    } catch (err) {
      zodError = err as ZodError;
    }

    const res = callHandler(zodError!);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({
      error: 'ValidationError',
      message: 'Validation failed',
    });
    expect((res.body as { details?: unknown[] }).details?.[0]).toMatchObject({
      field: 'amount',
    });
  });

  it('maps Prisma known request errors by code', () => {
    const conflictRes = callHandler(createKnownPrismaError('P2002', { target: ['account_name'] }));
    expect(conflictRes.status).toHaveBeenCalledWith(409);
    expect(conflictRes.body).toMatchObject({
      error: 'ConflictError',
      field: 'account_name',
    });

    const notFoundRes = callHandler(createKnownPrismaError('P2025'));
    expect(notFoundRes.status).toHaveBeenCalledWith(404);
    expect(notFoundRes.body).toMatchObject({
      error: 'NotFoundError',
    });

    const fkRes = callHandler(createKnownPrismaError('P2003'));
    expect(fkRes.status).toHaveBeenCalledWith(400);
    expect(fkRes.body).toMatchObject({
      error: 'ValidationError',
    });
  });

  it('maps Prisma validation errors to 400', () => {
    const res = callHandler(createValidationPrismaError());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({
      error: 'ValidationError',
      message: 'Invalid data provided',
    });
  });

  it('maps JWT errors by name', () => {
    const invalidToken = new Error('jwt malformed');
    invalidToken.name = 'JsonWebTokenError';
    const invalidRes = callHandler(invalidToken);
    expect(invalidRes.status).toHaveBeenCalledWith(401);
    expect(invalidRes.body).toMatchObject({
      error: 'UnauthorizedError',
      message: 'Invalid token',
    });

    const expiredToken = new Error('jwt expired');
    expiredToken.name = 'TokenExpiredError';
    const expiredRes = callHandler(expiredToken);
    expect(expiredRes.status).toHaveBeenCalledWith(401);
    expect(expiredRes.body).toMatchObject({
      error: 'UnauthorizedError',
      message: 'Token expired',
    });
  });

  it('uses generic 500 message in production and preserves message otherwise', () => {
    const prodError = new AppError('Sensitive', 500);
    process.env.NODE_ENV = 'production';
    const prodRes = callHandler(prodError);
    expect(prodRes.status).toHaveBeenCalledWith(500);
    expect(prodRes.body).toEqual({
      error: 'AppError',
      message: 'Sensitive',
    });

    const unknownError = new Error('Boom');
    process.env.NODE_ENV = 'production';
    const res = callHandler(unknownError);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    });

    process.env.NODE_ENV = 'test';
    const devRes = callHandler(new Error('Detailed'));
    expect(devRes.status).toHaveBeenCalledWith(500);
    expect(devRes.body).toEqual({
      error: 'InternalServerError',
      message: 'Detailed',
    });
  });

  it('logs the error to console.error', () => {
    callHandler(new NotFoundError('missing'));
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
