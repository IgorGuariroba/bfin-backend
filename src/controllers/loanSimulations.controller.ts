import type { Response } from 'express';
import { loanSimulationService } from '../services/loanSimulationService';
import type { AuthRequest } from '../types';
import {
  createLoanSimulationSchema,
  getLoanSimulationParamsSchema,
  listLoanSimulationsQuerySchema,
} from '../validators/loanSimulationSchemas';

export class LoanSimulationsController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const input = createLoanSimulationSchema.parse(req.body);
    const simulation = await loanSimulationService.createSimulation(req.user.userId, input);
    res.status(201).json(simulation);
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query = listLoanSimulationsQuerySchema.parse(req.query);
    const simulations = await loanSimulationService.listSimulations(
      req.user.userId,
      query.limit,
      query.offset
    );
    res.json(simulations);
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const params = getLoanSimulationParamsSchema.parse(req.params);
    const simulation = await loanSimulationService.getSimulation(
      req.user.userId,
      params.simulationId
    );
    res.json(simulation);
  }
}

export const loanSimulationsController = new LoanSimulationsController();
