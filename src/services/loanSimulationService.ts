import prisma from '../lib/prisma';
import { NotFoundError, ValidationError } from '../middlewares/errorHandler';
import {
  LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY,
  LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT,
  LOAN_SIMULATION_MAX_TERM_MONTHS,
  LOAN_SIMULATION_MIN_TERM_MONTHS,
} from '../types';
import type {
  InstallmentBreakdown,
  LoanSimulationCreateInput,
  LoanSimulationDetails,
  LoanSimulationSummary,
} from '../types';
import { AccountService } from './AccountService';
import { auditEventService } from './AuditEventService';
import {
  calculatePriceSchedule,
  calculateReserveImpact,
  roundMoney,
} from '../utils/loanSimulationCalculator';

const accountService = new AccountService();

function ensureTermWithinBounds(termMonths: number) {
  if (
    termMonths < LOAN_SIMULATION_MIN_TERM_MONTHS ||
    termMonths > LOAN_SIMULATION_MAX_TERM_MONTHS
  ) {
    throw new ValidationError(
      `termMonths must be between ${LOAN_SIMULATION_MIN_TERM_MONTHS} and ${LOAN_SIMULATION_MAX_TERM_MONTHS}`
    );
  }
}

function ensurePositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError('amount must be a positive number');
  }
}

function toInstallmentBreakdown(plan: InstallmentBreakdown[]): InstallmentBreakdown[] {
  return plan.map((installment) => ({
    installmentNumber: installment.installmentNumber,
    principalComponent: installment.principalComponent,
    interestComponent: installment.interestComponent,
    totalPayment: installment.totalPayment,
    remainingBalance: installment.remainingBalance,
  }));
}

export class LoanSimulationService {
  async createSimulation(
    userId: string,
    input: LoanSimulationCreateInput
  ): Promise<LoanSimulationDetails> {
    ensurePositiveAmount(input.amount);
    ensureTermWithinBounds(input.termMonths);

    const interestRateMonthly =
      input.interestRateMonthly ?? LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY;

    if (!Number.isFinite(interestRateMonthly) || interestRateMonthly <= 0) {
      throw new ValidationError('interestRateMonthly must be a positive number');
    }

    const result = await prisma.$transaction(async (tx) => {
      const reserveContext = await accountService.getDefaultEmergencyReserve(userId, tx);

      const reserveAmount = reserveContext.emergencyReserveAmount;
      const maxAllowedAmount = reserveAmount * (LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT / 100);

      if (input.amount > maxAllowedAmount) {
        throw new ValidationError(
          `Simulation exceeds reserve cap of ${LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT}%`
        );
      }

      const calculation = calculatePriceSchedule(
        input.amount,
        interestRateMonthly,
        input.termMonths
      );

      const reserveImpact = calculateReserveImpact(reserveAmount, input.amount);
      const reserveUsagePercent = reserveImpact.reserveUsagePercent;
      const reserveRemainingAmount = reserveImpact.reserveRemainingAmount;

      const simulation = await tx.loanSimulation.create({
        data: {
          user_id: userId,
          account_id: reserveContext.accountId,
          principal_amount: roundMoney(input.amount),
          term_months: input.termMonths,
          interest_rate_monthly: interestRateMonthly,
          amortization_type: 'PRICE',
          installment_amount: calculation.installmentAmount,
          total_interest: calculation.totalInterest,
          total_cost: calculation.totalCost,
          reserve_usage_percent: reserveUsagePercent,
          reserve_remaining_amount: reserveRemainingAmount,
          monthly_cashflow_impact: calculation.installmentAmount,
        },
      });

      await tx.installmentPlan.createMany({
        data: calculation.installmentPlan.map((installment) => ({
          simulation_id: simulation.id,
          installment_number: installment.installmentNumber,
          principal_component: installment.principalComponent,
          interest_component: installment.interestComponent,
          total_payment: installment.totalPayment,
          remaining_balance: installment.remainingBalance,
        })),
      });

      await tx.cashFlowImpact.create({
        data: {
          simulation_id: simulation.id,
          monthly_outflow: calculation.installmentAmount,
        },
      });

      await auditEventService.writeEvent(
        {
          userId,
          accountId: reserveContext.accountId,
          simulationId: simulation.id,
          eventType: 'loan_simulation_created',
          payload: {
            amount: roundMoney(input.amount),
            termMonths: input.termMonths,
            interestRateMonthly,
            reserveUsagePercent,
            reserveRemainingAmount,
          },
        },
        tx
      );

      const installmentPlan = toInstallmentBreakdown(calculation.installmentPlan);

      const details: LoanSimulationDetails = {
        id: simulation.id,
        createdAt: simulation.created_at,
        amount: Number(simulation.principal_amount),
        termMonths: simulation.term_months,
        interestRateMonthly: Number(simulation.interest_rate_monthly),
        amortizationType: 'PRICE',
        installmentAmount: Number(simulation.installment_amount),
        totalInterest: Number(simulation.total_interest),
        totalCost: Number(simulation.total_cost),
        reserveUsagePercent: Number(simulation.reserve_usage_percent),
        reserveRemainingAmount: Number(simulation.reserve_remaining_amount),
        monthlyCashflowImpact: Number(simulation.monthly_cashflow_impact),
        installmentPlan,
      };

      return details;
    });

    return result;
  }

  async listSimulations(userId: string, limit = 50, offset = 0): Promise<LoanSimulationSummary[]> {
    const simulations = await prisma.loanSimulation.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    return simulations.map((simulation) => ({
      id: simulation.id,
      createdAt: simulation.created_at,
      amount: Number(simulation.principal_amount),
      termMonths: simulation.term_months,
      interestRateMonthly: Number(simulation.interest_rate_monthly),
      installmentAmount: Number(simulation.installment_amount),
    }));
  }

  async getSimulation(userId: string, simulationId: string): Promise<LoanSimulationDetails> {
    const simulation = await prisma.loanSimulation.findFirst({
      where: { id: simulationId, user_id: userId },
      include: {
        installments: {
          orderBy: { installment_number: 'asc' },
        },
      },
    });

    if (!simulation) {
      throw new NotFoundError('Loan simulation not found');
    }

    return {
      id: simulation.id,
      createdAt: simulation.created_at,
      amount: Number(simulation.principal_amount),
      termMonths: simulation.term_months,
      interestRateMonthly: Number(simulation.interest_rate_monthly),
      amortizationType: 'PRICE',
      installmentAmount: Number(simulation.installment_amount),
      totalInterest: Number(simulation.total_interest),
      totalCost: Number(simulation.total_cost),
      reserveUsagePercent: Number(simulation.reserve_usage_percent),
      reserveRemainingAmount: Number(simulation.reserve_remaining_amount),
      monthlyCashflowImpact: Number(simulation.monthly_cashflow_impact),
      installmentPlan: simulation.installments.map((installment) => ({
        installmentNumber: installment.installment_number,
        principalComponent: Number(installment.principal_component),
        interestComponent: Number(installment.interest_component),
        totalPayment: Number(installment.total_payment),
        remainingBalance: Number(installment.remaining_balance),
      })),
    };
  }
}

export const loanSimulationService = new LoanSimulationService();
