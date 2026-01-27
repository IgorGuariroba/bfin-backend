import 'dotenv/config';
import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middlewares/errorHandler';
import { rateLimiter } from './middlewares/rateLimit';

const app = express();
const PORT = process.env.PORT || 3000;
const DOCS_ENABLED = process.env.NODE_ENV !== 'production';

app.set('trust proxy', 1);

// Middlewares globais
// Middlewares globais
app.use(helmet());

// CORS - Aceitar apenas www
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Swagger Documentation
if (DOCS_ENABLED) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'BFIN API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  );
}

// Rotas da API
app.get('/api/v1', (_req, res) => {
  res.json({
    message: 'BFIN API v1.0',
    version: '1.0.0',
    ...(DOCS_ENABLED ? { docs: '/api-docs' } : {}),
  });
});

// Importar rotas
import accountRoutes from './routes/accounts.routes';
import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/categories.routes';
import invitationRoutes from './routes/invitations.routes';
import loanSimulationRoutes from './routes/loanSimulations.routes';
import suggestionRoutes from './routes/suggestions.routes';
import transactionRoutes from './routes/transactions.routes';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/suggestions', suggestionRoutes);
app.use('/api/v1/invitations', invitationRoutes);
app.use('/api/v1/loan-simulations', loanSimulationRoutes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Error Handler (deve ser o último middleware)
app.use(errorHandler);

// Iniciar servidor apenas se não estiver em modo de teste
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
