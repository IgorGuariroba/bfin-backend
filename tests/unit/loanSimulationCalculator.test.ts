import { describe, expect, it } from 'vitest';
import { calculatePriceSchedule, roundMoney } from '../../src/utils/loanSimulationCalculator';

describe('loanSimulationCalculator - Price schedule', () => {
  it('calculates fixed installments, totals, and a complete schedule', () => {
    const result = calculatePriceSchedule(1000, 0.025, 12);

    expect(result.installmentAmount).toBe(97.49);
    expect(result.totalInterest).toBe(169.84);
    expect(result.totalCost).toBe(1169.84);

    expect(result.installmentPlan).toHaveLength(12);
    expect(result.installmentPlan[0]).toMatchObject({
      installmentNumber: 1,
      principalComponent: 72.49,
      interestComponent: 25,
      totalPayment: 97.49,
      remainingBalance: 927.51,
    });

    const lastInstallment = result.installmentPlan[result.installmentPlan.length - 1];
    expect(lastInstallment.installmentNumber).toBe(12);
    expect(lastInstallment.remainingBalance).toBe(0);
  });

  it('rounds money to two decimal places', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });
});
