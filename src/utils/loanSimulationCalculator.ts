import type { InstallmentBreakdown } from '../types';

export interface PriceCalculationResult {
  installmentAmount: number;
  totalInterest: number;
  totalCost: number;
  installmentPlan: InstallmentBreakdown[];
}

export interface ReserveImpactResult {
  reserveUsagePercent: number;
  reserveRemainingAmount: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateInstallmentAmount(
  principal: number,
  monthlyRate: number,
  termMonths: number
): number {
  if (monthlyRate === 0) {
    return principal / termMonths;
  }

  const rateFactor = Math.pow(1 + monthlyRate, termMonths);
  const rawInstallment = (principal * monthlyRate * rateFactor) / (rateFactor - 1);
  return rawInstallment;
}

export function calculatePriceSchedule(
  principal: number,
  monthlyRate: number,
  termMonths: number
): PriceCalculationResult {
  const rawInstallmentAmount = calculateInstallmentAmount(principal, monthlyRate, termMonths);
  const installmentAmount = roundMoney(rawInstallmentAmount);

  const installmentPlan: InstallmentBreakdown[] = [];
  let remainingBalance = principal;
  let totalInterest = 0;

  for (let installmentNumber = 1; installmentNumber <= termMonths; installmentNumber += 1) {
    const isLastInstallment = installmentNumber === termMonths;
    const rawInterestComponent = remainingBalance * monthlyRate;
    const interestComponent = roundMoney(rawInterestComponent);

    let principalComponent = roundMoney(installmentAmount - interestComponent);

    if (isLastInstallment) {
      principalComponent = roundMoney(remainingBalance);
    }

    const totalPayment = roundMoney(principalComponent + interestComponent);
    remainingBalance = roundMoney(remainingBalance - principalComponent);

    if (isLastInstallment && remainingBalance !== 0) {
      remainingBalance = 0;
    }

    totalInterest = roundMoney(totalInterest + interestComponent);

    installmentPlan.push({
      installmentNumber,
      principalComponent,
      interestComponent,
      totalPayment,
      remainingBalance,
    });
  }

  const totalCost = roundMoney(principal + totalInterest);

  return {
    installmentAmount,
    totalInterest,
    totalCost,
    installmentPlan,
  };
}

export function calculateReserveImpact(
  reserveAmount: number,
  principal: number
): ReserveImpactResult {
  if (!Number.isFinite(reserveAmount) || reserveAmount <= 0) {
    throw new Error('reserveAmount must be a positive number');
  }

  const reserveUsagePercent = roundMoney((principal / reserveAmount) * 100);
  const reserveRemainingAmount = roundMoney(reserveAmount - principal);

  return {
    reserveUsagePercent,
    reserveRemainingAmount,
  };
}
