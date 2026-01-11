import request from 'supertest';
import app from '../server';
import prisma from '../lib/prisma';

export const testRequest = request(app);

interface CreateUserOptions {
  email?: string;
  password?: string;
  full_name?: string;
}

export async function createTestUser(options: CreateUserOptions = {}) {
  const timestamp = Date.now();
  const email = options.email || `test${timestamp}@example.com`;
  const password = options.password || 'password123';
  const full_name = options.full_name || 'Test User';

  const response = await testRequest
    .post('/api/v1/auth/register')
    .send({ email, password, full_name })
    .expect(201);

  return {
    user: response.body.user,
    tokens: response.body.tokens,
    password,
  };
}

export async function createTestAccount(userId: string, accountName = 'Test Account') {
  return await prisma.account.create({
    data: {
      user_id: userId,
      account_name: accountName,
      account_type: 'checking',
      is_default: true,
    },
  });
}

export async function createTestCategory(
  accountId: string,
  name = 'Test Category',
  type: 'income' | 'expense' = 'expense'
) {
  return await prisma.category.create({
    data: {
      account_id: accountId,
      name,
      type,
      is_system: false,
    },
  });
}

export function getAuthHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
