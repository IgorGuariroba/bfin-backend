import rateLimit from 'express-rate-limit';

// Desabilitar rate limiting em ambiente de teste
const isTest = process.env.NODE_ENV === 'test';

export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  skip: () => isTest,
  trustProxy: true, // ← ADICIONE ESTA LINHA
  message: {
    error: 'TooManyRequestsError',
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: () => isTest,
  trustProxy: true, // ← ADICIONE ESTA LINHA
  message: {
    error: 'TooManyRequestsError',
    message: 'Too many login attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const transactionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  skip: () => isTest,
  trustProxy: true, // ← ADICIONE ESTA LINHA
  message: {
    error: 'TooManyRequestsError',
    message: 'Too many transactions, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
