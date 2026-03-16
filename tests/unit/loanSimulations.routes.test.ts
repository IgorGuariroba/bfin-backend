import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loanSimulationsController } from '../../src/controllers/loanSimulations.controller';
import loanSimulationsRouter from '../../src/routes/loanSimulations.routes';

// Mock controller methods
vi.mock('../../src/controllers/loanSimulations.controller', () => ({
  loanSimulationsController: {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    approve: vi.fn(),
    withdraw: vi.fn(),
  },
}));

// Mock auth middleware to bypass authentication
vi.mock('../../src/middlewares/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', email: 'test@example.com' };
    next();
  },
}));

describe('loanSimulations routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/loan-simulations', loanSimulationsRouter);
    vi.clearAllMocks();
  });

  describe('POST /api/v1/loan-simulations', () => {
    it('should call create controller method', async () => {
      const mockSimulation = { id: 'sim-1', amount: 1000 };
      vi.mocked(loanSimulationsController.create).mockImplementation(async (_req, res) => {
        res.status(201).json(mockSimulation);
        return Promise.resolve();
      });

      const response = await request(app)
        .post('/api/v1/loan-simulations')
        .send({ amount: 1000, termMonths: 12 });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockSimulation);
      expect(loanSimulationsController.create).toHaveBeenCalled();
    });

    it('should handle controller errors', async () => {
      vi.mocked(loanSimulationsController.create).mockImplementation(async () => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .post('/api/v1/loan-simulations')
        .send({ amount: 1000, termMonths: 12 });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/loan-simulations', () => {
    it('should call list controller method', async () => {
      const mockSimulations = [{ id: 'sim-1', amount: 1000 }];
      vi.mocked(loanSimulationsController.list).mockImplementation(async (_req, res) => {
        res.json(mockSimulations);
        return Promise.resolve();
      });

      const response = await request(app).get('/api/v1/loan-simulations');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSimulations);
      expect(loanSimulationsController.list).toHaveBeenCalled();
    });

    it('should pass query parameters to controller', async () => {
      vi.mocked(loanSimulationsController.list).mockImplementation(async (_req, res) => {
        res.json({ query: _req.query });
        return Promise.resolve();
      });

      const response = await request(app).get(
        '/api/v1/loan-simulations?limit=10&offset=0&status=PENDING'
      );

      expect(response.status).toBe(200);
      expect(loanSimulationsController.list).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/loan-simulations/:simulationId', () => {
    it('should call getById controller method', async () => {
      const mockSimulation = { id: 'sim-1', amount: 1000 };
      vi.mocked(loanSimulationsController.getById).mockImplementation(async (_req, res) => {
        res.json(mockSimulation);
        return Promise.resolve();
      });

      const response = await request(app).get('/api/v1/loan-simulations/sim-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSimulation);
      expect(loanSimulationsController.getById).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/loan-simulations/:id/approve', () => {
    it('should call approve controller method', async () => {
      const mockResult = { message: 'Approved', simulation: { id: 'sim-1' } };
      vi.mocked(loanSimulationsController.approve).mockImplementation(async (_req, res) => {
        res.json(mockResult);
        return Promise.resolve();
      });

      const response = await request(app).post('/api/v1/loan-simulations/sim-1/approve');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(loanSimulationsController.approve).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/loan-simulations/:id/withdraw', () => {
    it('should call withdraw controller method', async () => {
      const mockResult = { message: 'Withdrawn', simulation: { id: 'sim-1' } };
      vi.mocked(loanSimulationsController.withdraw).mockImplementation(async (_req, res) => {
        res.json(mockResult);
        return Promise.resolve();
      });

      const response = await request(app).post('/api/v1/loan-simulations/sim-1/withdraw');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(loanSimulationsController.withdraw).toHaveBeenCalled();
    });
  });
});
