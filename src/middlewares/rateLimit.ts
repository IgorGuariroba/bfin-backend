import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minuto
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests por minuto
  message: {
    error: 'TooManyRequestsError',
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Usar IP do usuário como identificador
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
});

// Rate limiter mais restritivo para autenticação
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas de login
  message: {
    error: 'TooManyRequestsError',
    message: 'Too many login attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não contar requests bem-sucedidos
});

// Rate limiter para operações financeiras críticas
export const transactionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // 20 transações por minuto
  message: {
    error: 'TooManyRequestsError',
    message: 'Too many transactions, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
