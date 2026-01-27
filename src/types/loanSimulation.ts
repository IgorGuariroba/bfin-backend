export const LOAN_SIMULATION_DEFAULT_INTEREST_RATE_MONTHLY = 0.025;
export const LOAN_SIMULATION_MAX_RESERVE_USAGE_PERCENT = 70;
export const LOAN_SIMULATION_MIN_TERM_MONTHS = 6;
export const LOAN_SIMULATION_MAX_TERM_MONTHS = 30;

export type AmortizationType = 'PRICE';

export interface LoanSimulationCreateInput {
  amount: number;
  termMonths: number;
  interestRateMonthly?: number;
}

export interface InstallmentBreakdown {
  installmentNumber: number;
  principalComponent: number;
  interestComponent: number;
  totalPayment: number;
  remainingBalance: number;
}

export interface LoanSimulationResult {
  amount: number;
  termMonths: number;
  interestRateMonthly: number;
  amortizationType: AmortizationType;
  installmentAmount: number;
  totalInterest: number;
  totalCost: number;
  reserveUsagePercent: number;
  reserveRemainingAmount: number;
  monthlyCashflowImpact: number;
  installmentPlan: InstallmentBreakdown[];
}

export interface LoanSimulationSummary {
  id: string;
  createdAt: Date;
  amount: number;
  termMonths: number;
  interestRateMonthly: number;
  installmentAmount: number;
}

export interface LoanSimulationDetails extends LoanSimulationResult {
  id: string;
  createdAt: Date;
}

export interface EmergencyReserveContext {
  accountId: string;
  currency: string;
  emergencyReserveAmount: number;
}
