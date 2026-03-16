import { describe, expect, it } from 'vitest';
import {
  calculatePriceSchedule,
  roundMoney,
  calculateReserveImpact,
} from '../../src/utils/loanSimulationCalculator';

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

  it('handles zero interest rate', () => {
    const result = calculatePriceSchedule(1200, 0, 12);

    expect(result.installmentAmount).toBe(100);
    expect(result.totalInterest).toBe(0);
    expect(result.totalCost).toBe(1200);
    expect(result.installmentPlan).toHaveLength(12);
  });

  it('calculates short term schedule', () => {
    const result = calculatePriceSchedule(500, 0.01, 3);

    expect(result.installmentPlan).toHaveLength(3);
    expect(result.totalCost).toBeGreaterThan(500);
  });

  it('ensures last installment clears remaining balance', () => {
    const result = calculatePriceSchedule(1000, 0.025, 6);

    const lastInstallment = result.installmentPlan[result.installmentPlan.length - 1];
    expect(lastInstallment.remainingBalance).toBe(0);
  });
});

describe('loanSimulationCalculator - Reserve Impact', () => {
  it('calculates reserve impact correctly', () => {
    const result = calculateReserveImpact(1000, 300);

    expect(result.reserveUsagePercent).toBe(30);
    expect(result.reserveRemainingAmount).toBe(700);
  });

  it('calculates reserve impact for full usage', () => {
    const result = calculateReserveImpact(1000, 1000);

    expect(result.reserveUsagePercent).toBe(100);
    expect(result.reserveRemainingAmount).toBe(0);
  });

  it('calculates reserve impact for partial usage', () => {
    const result = calculateReserveImpact(5000, 1500);

    expect(result.reserveUsagePercent).toBe(30);
    expect(result.reserveRemainingAmount).toBe(3500);
  });

  it('throws error when reserve amount is zero', () => {
    expect(() => calculateReserveImpact(0, 100)).toThrow('reserveAmount must be a positive number');
  });

  it('throws error when reserve amount is negative', () => {
    expect(() => calculateReserveImpact(-100, 50)).toThrow(
      'reserveAmount must be a positive number'
    );
  });

  it('throws error when reserve amount is not finite', () => {
    expect(() => calculateReserveImpact(Infinity, 100)).toThrow(
      'reserveAmount must be a positive number'
    );
    expect(() => calculateReserveImpact(NaN, 100)).toThrow(
      'reserveAmount must be a positive number'
    );
  });
});

describe('roundMoney', () => {
  it('rounds positive numbers correctly', () => {
    expect(roundMoney(100.999)).toBe(101);
    expect(roundMoney(100.994)).toBe(100.99);
    expect(roundMoney(100.995)).toBe(101);
  });

  it('handles zero', () => {
    expect(roundMoney(0)).toBe(0);
  });

  it('handles small values', () => {
    expect(roundMoney(0.001)).toBe(0);
    expect(roundMoney(0.005)).toBe(0.01);
    expect(roundMoney(0.01)).toBe(0.01);
  });

  it('handles large values', () => {
    expect(roundMoney(1000000.999)).toBe(1000001);
    expect(roundMoney(999999.001)).toBe(999999);
  });
});
