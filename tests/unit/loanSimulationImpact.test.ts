import { describe, expect, it } from 'vitest';
import { calculateReserveImpact } from '../../src/utils/loanSimulationCalculator';

describe('loanSimulationCalculator - reserve impact', () => {
  it('calculates reserve usage percent and remaining amount', () => {
    const impact = calculateReserveImpact(1000, 600);

    expect(impact.reserveUsagePercent).toBe(60);
    expect(impact.reserveRemainingAmount).toBe(400);
  });

  it('rounds reserve impact values to two decimals', () => {
    const impact = calculateReserveImpact(1000, 333.33);

    expect(impact.reserveUsagePercent).toBe(33.33);
    expect(impact.reserveRemainingAmount).toBe(666.67);
  });
});
