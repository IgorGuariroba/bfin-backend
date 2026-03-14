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
  LoanSimulationStatus,
  ApprovalResponse,
  WithdrawalResponse,
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
        status: simulation.status,
        approvedAt: simulation.approved_at,
        withdrawnAt: simulation.withdrawn_at,
      };

      return details;
    });

    return result;
  }

  async listSimulations(
    userId: string,
    limit = 50,
    offset = 0,
    status?: LoanSimulationStatus
  ): Promise<LoanSimulationSummary[]> {
    const simulations = await prisma.loanSimulation.findMany({
      where: {
        user_id: userId,
        ...(status && { status }),
      },
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
      status: simulation.status,
      approvedAt: simulation.approved_at,
      withdrawnAt: simulation.withdrawn_at,
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
      status: simulation.status,
      approvedAt: simulation.approved_at,
      withdrawnAt: simulation.withdrawn_at,
    };
  }

  async approveSimulation(userId: string, simulationId: string): Promise<ApprovalResponse> {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate simulation exists and belongs to user
      const simulation = await tx.loanSimulation.findFirst({
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

      // 2. Check status is PENDING
      if (simulation.status !== 'PENDING') {
        throw new ValidationError(
          `Cannot approve simulation with status ${simulation.status}. Only PENDING simulations can be approved.`
        );
      }

      // 3. Validate 30-day expiration
      const now = new Date();
      const createdAt = new Date(simulation.created_at);
      const daysSinceCreation = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceCreation > 30) {
        throw new ValidationError(
          'Simulation has expired. Simulations are only valid for 30 days after creation.'
        );
      }

      // 4. Get emergency reserve context
      const reserveContext = await accountService.getDefaultEmergencyReserve(userId, tx);
      const reserveAmount = reserveContext.emergencyReserveAmount;

      // 5. Calculate sum of active loans (APPROVED + COMPLETED)
      const activeLoansAggregate = await tx.loanSimulation.aggregate({
        where: {
          user_id: userId,
          account_id: reserveContext.accountId,
          status: { in: ['APPROVED', 'COMPLETED'] },
        },
        _sum: {
          principal_amount: true,
        },
      });

      const activeLoansTotal = Number(activeLoansAggregate._sum.principal_amount ?? 0);
      const currentSimulationAmount = Number(simulation.principal_amount);
      const totalUsage = activeLoansTotal + currentSimulationAmount;

      // 6. Validate reserve limit
      const maxAllowedAmount = reserveAmount * (LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT / 100);

      if (totalUsage > maxAllowedAmount) {
        throw new ValidationError(
          `Approval would exceed reserve limit. Current active loans: ${activeLoansTotal.toFixed(2)}, ` +
            `requested amount: ${currentSimulationAmount.toFixed(2)}, ` +
            `total: ${totalUsage.toFixed(2)}, ` +
            `maximum allowed (${LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT}% of ${reserveAmount.toFixed(2)}): ${maxAllowedAmount.toFixed(2)}`
        );
      }

      // 7. Update simulation: status=APPROVED, approved_at=now()
      const approvedSimulation = await tx.loanSimulation.update({
        where: { id: simulationId },
        data: {
          status: 'APPROVED',
          approved_at: now,
        },
        include: {
          installments: {
            orderBy: { installment_number: 'asc' },
          },
        },
      });

      // 8. Create audit event
      await auditEventService.writeEvent(
        {
          userId,
          accountId: reserveContext.accountId,
          simulationId,
          eventType: 'loan_simulation_approved',
          payload: {
            amount: currentSimulationAmount,
            termMonths: simulation.term_months,
            activeLoansTotal,
            totalUsage,
            reserveLimit: maxAllowedAmount,
          },
        },
        tx
      );

      // 9. Return LoanSimulationDetails
      const details: LoanSimulationDetails = {
        id: approvedSimulation.id,
        createdAt: approvedSimulation.created_at,
        amount: Number(approvedSimulation.principal_amount),
        termMonths: approvedSimulation.term_months,
        interestRateMonthly: Number(approvedSimulation.interest_rate_monthly),
        amortizationType: 'PRICE',
        installmentAmount: Number(approvedSimulation.installment_amount),
        totalInterest: Number(approvedSimulation.total_interest),
        totalCost: Number(approvedSimulation.total_cost),
        reserveUsagePercent: Number(approvedSimulation.reserve_usage_percent),
        reserveRemainingAmount: Number(approvedSimulation.reserve_remaining_amount),
        monthlyCashflowImpact: Number(approvedSimulation.monthly_cashflow_impact),
        installmentPlan: approvedSimulation.installments.map((installment) => ({
          installmentNumber: installment.installment_number,
          principalComponent: Number(installment.principal_component),
          interestComponent: Number(installment.interest_component),
          totalPayment: Number(installment.total_payment),
          remainingBalance: Number(installment.remaining_balance),
        })),
        status: approvedSimulation.status,
        approvedAt: approvedSimulation.approved_at,
        withdrawnAt: approvedSimulation.withdrawn_at,
      };

      return {
        simulation: details,
        message: 'Loan simulation approved successfully',
      };
    });

    return result;
  }

  async withdrawFunds(userId: string, simulationId: string): Promise<WithdrawalResponse> {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get simulation with account relation
      const simulation = await tx.loanSimulation.findFirst({
        where: { id: simulationId, user_id: userId },
        include: {
          account: true,
          installments: {
            orderBy: { installment_number: 'asc' },
          },
        },
      });

      if (!simulation) {
        throw new NotFoundError('Loan simulation not found');
      }

      // 2. Validate status is APPROVED
      if (simulation.status !== 'APPROVED') {
        throw new ValidationError(
          `Cannot withdraw from simulation with status ${simulation.status}. Only APPROVED simulations can be withdrawn.`
        );
      }

      // 3. Get current account balances
      const account = simulation.account;
      const currentReserve = Number(account.emergency_reserve);
      const currentAvailable = Number(account.available_balance);
      const principalAmount = Number(simulation.principal_amount);

      // 4. Validate reserve balance is sufficient
      if (currentReserve < principalAmount) {
        throw new ValidationError(
          `Insufficient emergency reserve. Available reserve: ${currentReserve.toFixed(2)}, ` +
            `required: ${principalAmount.toFixed(2)}`
        );
      }

      // 5. Calculate active loans total for revalidation
      const activeLoansAggregate = await tx.loanSimulation.aggregate({
        where: {
          user_id: userId,
          account_id: account.id,
          status: { in: ['APPROVED', 'COMPLETED'] },
          id: { not: simulationId }, // Exclude current simulation
        },
        _sum: {
          principal_amount: true,
        },
      });

      const activeLoansTotal = Number(activeLoansAggregate._sum.principal_amount ?? 0);
      const totalUsage = activeLoansTotal + principalAmount;

      // 6. Revalidate reserve limit with current reserve
      const maxAllowedAmount = currentReserve * (LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT / 100);

      if (totalUsage > maxAllowedAmount) {
        throw new ValidationError(
          `Withdrawal would exceed reserve limit. Current active loans: ${activeLoansTotal.toFixed(2)}, ` +
            `requested amount: ${principalAmount.toFixed(2)}, ` +
            `total: ${totalUsage.toFixed(2)}, ` +
            `maximum allowed (${LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT}% of current reserve ${currentReserve.toFixed(2)}): ${maxAllowedAmount.toFixed(2)}`
        );
      }

      // 7. Capture balances before
      const balancesBefore = {
        emergencyReserveBefore: currentReserve,
        availableBalanceBefore: currentAvailable,
      };

      // 8. Update account balances atomically
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          emergency_reserve: { decrement: principalAmount },
          available_balance: { increment: principalAmount },
        },
      });

      // 9. Update simulation status to COMPLETED
      const now = new Date();
      const completedSimulation = await tx.loanSimulation.update({
        where: { id: simulationId },
        data: {
          status: 'COMPLETED',
          withdrawn_at: now,
        },
        include: {
          installments: {
            orderBy: { installment_number: 'asc' },
          },
        },
      });

      // 10. Capture balances after
      const balancesAfter = {
        emergencyReserveAfter: Number(updatedAccount.emergency_reserve),
        availableBalanceAfter: Number(updatedAccount.available_balance),
      };

      // 10.1 Create transactions for each installment to appear in the calendar
      // Find or create a category for Loan Payments
      let loanCategory = await tx.category.findFirst({
        where: { name: 'Empréstimo (Reserva)', is_system: true },
      });

      if (!loanCategory) {
        loanCategory = await tx.category.create({
          data: {
            name: 'Empréstimo (Reserva)',
            type: 'expense',
            color: '#FF9800',
            icon: 'account_balance_wallet',
            is_system: true,
          },
        });
      }

      const installmentTransactions = [];
      const baseDueDate = new Date(now);

      for (const installment of completedSimulation.installments) {
        // Calculate due date: same day of month for each subsequent month
        const dueDate = new Date(baseDueDate);
        dueDate.setMonth(baseDueDate.getMonth() + installment.installment_number);

        const transaction = await tx.transaction.create({
          data: {
            account_id: account.id,
            category_id: loanCategory.id,
            type: 'fixed_expense',
            amount: installment.total_payment,
            description: `Parcela ${installment.installment_number}/${completedSimulation.term_months} - Empréstimo Reserva`,
            due_date: dueDate,
            status: 'pending',
          },
        });
        installmentTransactions.push(transaction);
      }

      // 11. Create audit event
      await auditEventService.writeEvent(
        {
          userId,
          accountId: account.id,
          simulationId,
          eventType: 'loan_simulation_withdrawn',
          payload: {
            amount: principalAmount,
            balanceSnapshot: {
              ...balancesBefore,
              ...balancesAfter,
            },
          },
        },
        tx
      );

      // 12. Build response
      const details: LoanSimulationDetails = {
        id: completedSimulation.id,
        createdAt: completedSimulation.created_at,
        amount: Number(completedSimulation.principal_amount),
        termMonths: completedSimulation.term_months,
        interestRateMonthly: Number(completedSimulation.interest_rate_monthly),
        amortizationType: 'PRICE',
        installmentAmount: Number(completedSimulation.installment_amount),
        totalInterest: Number(completedSimulation.total_interest),
        totalCost: Number(completedSimulation.total_cost),
        reserveUsagePercent: Number(completedSimulation.reserve_usage_percent),
        reserveRemainingAmount: Number(completedSimulation.reserve_remaining_amount),
        monthlyCashflowImpact: Number(completedSimulation.monthly_cashflow_impact),
        installmentPlan: completedSimulation.installments.map((installment) => ({
          installmentNumber: installment.installment_number,
          principalComponent: Number(installment.principal_component),
          interestComponent: Number(installment.interest_component),
          totalPayment: Number(installment.total_payment),
          remainingBalance: Number(installment.remaining_balance),
        })),
        status: completedSimulation.status,
        approvedAt: completedSimulation.approved_at,
        withdrawnAt: completedSimulation.withdrawn_at,
      };

      return {
        simulation: details,
        balances: {
          ...balancesBefore,
          ...balancesAfter,
        },
        message: 'Funds withdrawn successfully from emergency reserve',
      };
    });

    return result;
  }
}

export const loanSimulationService = new LoanSimulationService();
