import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { withAuth } from '../../src/middlewares/withAuth';
import type { AuthRequest, JWTPayload } from '../../src/types';

describe('withAuth', () => {
  const mockUser: JWTPayload = {
    userId: 'test-user-id',
    email: 'test@example.com',
  };

  const createMockRequest = (user?: JWTPayload) => {
    const req = {
      user,
      body: {},
      query: {},
      params: {},
      headers: {},
    } as unknown as AuthRequest;
    return req;
  };

  const createMockResponse = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return res as unknown as Response;
  };

  it('should call handler when user is authenticated', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const middleware = withAuth(handler);

    const req = createMockRequest(mockUser);
    const res = createMockResponse();

    await middleware(req, res);

    expect(handler).toHaveBeenCalledWith(req, res);
  });

  it('should return 401 when user is not authenticated', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const middleware = withAuth(handler);

    const req = createMockRequest(undefined);
    const res = createMockResponse();

    await middleware(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Não autorizado' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return 401 when user is null', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const middleware = withAuth(handler);

    const req = createMockRequest(null as unknown as undefined);
    const res = createMockResponse();

    await middleware(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Não autorizado' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should pass request and response to handler correctly', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const middleware = withAuth(handler);

    const req = createMockRequest(mockUser);
    const res = createMockResponse();

    await middleware(req, res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.anything(), expect.anything());
  });
});
