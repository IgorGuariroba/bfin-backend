import { describe, it, expect } from "vitest";
import { makeInsightsService, InsightsValidationError } from "./service.js";
import type { InsightsRepo } from "./ports.js";
import type { Movement } from "./types.js";

// Repo fake em memória: prova que o core é testável sem DB e sem Next (ADR-0013).
function makeFakeRepo(
  movements: Movement[] = [],
  previsoes: number[] = [],
): InsightsRepo {
  const inRange = (d: Date, range: { gte?: Date; lt: Date }) =>
    (!range.gte || d >= range.gte) && d < range.lt;

  return {
    sumByType: async (_userId, range) => {
      const byType: Record<string, number> = {};
      for (const m of movements) {
        if (inRange(m.date, range))
          byType[m.type] = (byType[m.type] ?? 0) + m.amount;
      }
      return byType;
    },
    listMovements: async (_userId, range) =>
      movements
        .filter((m) => inRange(m.date, range))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    sumPrevisoes: async () => previsoes.reduce((s, p) => s + p, 0),
  };
}

function mov(type: string, amount: number, date: Date): Movement {
  return { type, amount, date };
}

function makeService(movements: Movement[] = [], previsoes: number[] = []) {
  return makeInsightsService(makeFakeRepo(movements, previsoes));
}

describe("getTotais", () => {
  it("soma por tipo no mês e deriva custoVida/performance/saldoAtual", async () => {
    const service = makeService([
      mov("entrada", 5000, new Date(2026, 5, 1, 12)),
      mov("saida", 800, new Date(2026, 5, 5, 12)),
      mov("cartao", 200, new Date(2026, 5, 6, 12)),
      mov("diario", 100, new Date(2026, 5, 7, 12)),
      mov("economia", 300, new Date(2026, 5, 8, 12)),
    ]);

    const t = await service.getTotais("u1", "2026-06");

    expect(t.entradas).toBe(5000);
    expect(t.saidas).toBe(800);
    expect(t.cartao).toBe(200);
    expect(t.diarios).toBe(100);
    expect(t.economia).toBe(300);
    expect(t.custoVida).toBe(1100); // saida + cartao + diario
    expect(t.performance).toBe(3900); // entrada - custoVida
    expect(t.saldoAnterior).toBe(0);
    expect(t.saldoAtual).toBe(3900); // saldoAnterior + performance
  });

  it("acumula saldoAnterior de meses passados e expõe comparação prevMonth", async () => {
    const service = makeService([
      // Mês anterior (maio/2026): entrada 2000, custo de vida 500 → performance 1500.
      mov("entrada", 2000, new Date(2026, 4, 2, 12)),
      mov("saida", 500, new Date(2026, 4, 3, 12)),
      // Mês corrente (junho/2026)
      mov("entrada", 1000, new Date(2026, 5, 2, 12)),
    ]);

    const t = await service.getTotais("u1", "2026-06");

    // saldoAnterior = tudo antes de 01/jun = entrada(2000) - saida(500) = 1500
    expect(t.saldoAnterior).toBe(1500);
    expect(t.saldoAtual).toBe(2500); // 1500 + (1000 - 0)
    expect(t.prevMonth).not.toBeNull();
    expect(t.prevMonth?.saldoAtual).toBe(1500); // performance de maio
    expect(t.prevMonth?.custoVida).toBe(500);
  });

  it("prevMonth é null quando o mês anterior não teve movimento", async () => {
    const service = makeService([
      mov("entrada", 1000, new Date(2026, 5, 2, 12)),
    ]);

    const t = await service.getTotais("u1", "2026-06");

    expect(t.prevMonth).toBeNull();
  });

  it("no mês corrente, diarioMedio divide pelos dias decorridos (clock injetado)", async () => {
    const service = makeInsightsService(
      makeFakeRepo([mov("diario", 100, new Date(2026, 5, 3, 12))], [300]),
      { now: () => new Date(2026, 5, 10, 15) }, // 10/jun/2026
    );

    const t = await service.getTotais("u1", "2026-06");

    expect(t.daysElapsed).toBe(10);
    expect(t.daysInMonth).toBe(30);
    expect(t.diarioMedio).toBe(10); // 100 / 10 dias decorridos
    expect(t.diarioPrev).toBe(10); // previsão 300 / 30 dias do mês
  });

  it("rejeita mês malformado", async () => {
    const service = makeService();
    await expect(service.getTotais("u1", "2026/06")).rejects.toBeInstanceOf(
      InsightsValidationError,
    );
    // mês 00 casa o regex mas é inválido — não pode escapar como NaN.
    await expect(service.getTotais("u1", "2026-00")).rejects.toBeInstanceOf(
      InsightsValidationError,
    );
  });
});

describe("getSaldos", () => {
  it("acumula saldo dia a dia partindo do saldo dos meses anteriores", async () => {
    const service = makeService([
      // Saldo anterior: maio entrada 1000 → prevByType.entrada = 1000.
      mov("entrada", 1000, new Date(2026, 4, 10, 12)),
      // Junho: dia 2 gasta 200 (saida); dia 5 entra 500.
      mov("saida", 200, new Date(2026, 5, 2, 12)),
      mov("entrada", 500, new Date(2026, 5, 5, 12)),
    ]);

    const { entries, prevByType } = await service.getSaldos("u1", "2026-06");

    expect(prevByType.entrada).toBe(1000);
    expect(entries).toHaveLength(30); // junho tem 30 dias
    // Dia 1: sem movimento → saldo segue 1000.
    expect(entries[0].day).toBe(1);
    expect(entries[0].date).toBe("2026-06-01");
    expect(entries[0].accSaldo).toBe(1000);
    // Dia 2: -200 → 800.
    expect(entries[1].accSaldo).toBe(800);
    expect(entries[1].byType.saida).toBe(200);
    // Dia 5: +500 → 1300.
    expect(entries[4].accSaldo).toBe(1300);
    // Último dia mantém o acumulado.
    expect(entries[29].accSaldo).toBe(1300);
  });
});

describe("getMonthSummary", () => {
  it("resume o mês respondendo 'quanto sobrou' (sobrou = performance)", async () => {
    const service = makeService([
      mov("entrada", 5000, new Date(2026, 5, 1, 12)),
      mov("saida", 800, new Date(2026, 5, 5, 12)),
      mov("cartao", 200, new Date(2026, 5, 6, 12)),
      mov("economia", 500, new Date(2026, 5, 8, 12)),
    ]);

    const s = await service.getMonthSummary("u1", "2026-06");

    expect(s.month).toBe("2026-06");
    expect(s.entradas).toBe(5000);
    expect(s.custoVida).toBe(1000); // saida + cartao
    expect(s.economia).toBe(500);
    expect(s.sobrouNoMes).toBe(4000); // entrada - custoVida
    expect(s.saldoAtual).toBe(4000);
  });
});

describe("getSugestoes", () => {
  it("aponta saldo negativo quando o acumulado fecha abaixo de zero", async () => {
    const service = makeService([
      // Sem saldo anterior; gasta mais do que entra → saldoAtual < 0.
      mov("entrada", 100, new Date(2026, 5, 1, 12)),
      mov("saida", 900, new Date(2026, 5, 2, 12)),
    ]);

    const sugestoes = await service.getSugestoes("u1", "2026-06");

    expect(sugestoes.map((s) => s.tipo)).toContain("saldo_negativo");
    const s = sugestoes.find((x) => x.tipo === "saldo_negativo");
    expect(s?.severidade).toBe("alerta");
    expect(s?.texto).toBeTruthy();
  });

  it("aponta diário acima do previsto quando o gasto diário supera a Previsão", async () => {
    const service = makeService(
      [
        // Mês passado (maio): diário 3000 / 31 dias ≈ 96,7/dia >> previsão 30/31 ≈ 0,97/dia.
        mov("entrada", 9000, new Date(2026, 4, 1, 12)), // mantém saldo positivo
        mov("diario", 3000, new Date(2026, 4, 10, 12)),
      ],
      [30],
    );

    const sugestoes = await service.getSugestoes("u1", "2026-05");

    expect(sugestoes.map((s) => s.tipo)).toContain("diario_acima");
    expect(sugestoes.map((s) => s.tipo)).not.toContain("saldo_negativo");
  });

  it("aponta economia baixa quando guardou menos de 10% da renda", async () => {
    const service = makeService([
      mov("entrada", 5000, new Date(2026, 5, 1, 12)),
      mov("saida", 1000, new Date(2026, 5, 5, 12)),
      mov("economia", 100, new Date(2026, 5, 8, 12)), // 2% da renda
    ]);

    const sugestoes = await service.getSugestoes("u1", "2026-06");

    expect(sugestoes.map((s) => s.tipo)).toContain("economia_baixa");
  });

  it("aponta custo de vida em alta quando supera o do mês anterior", async () => {
    const service = makeService([
      // Maio: custo de vida 1000.
      mov("entrada", 9000, new Date(2026, 4, 1, 12)),
      mov("saida", 1000, new Date(2026, 4, 5, 12)),
      // Junho: custo de vida 3000 (subiu), economia saudável, saldo positivo.
      mov("entrada", 9000, new Date(2026, 5, 1, 12)),
      mov("saida", 3000, new Date(2026, 5, 5, 12)),
      mov("economia", 2000, new Date(2026, 5, 8, 12)),
    ]);

    const sugestoes = await service.getSugestoes("u1", "2026-06");

    expect(sugestoes.map((s) => s.tipo)).toContain("custo_subiu");
  });

  it("não sugere nada num mês saudável (saldo positivo, economia ok, sem previsão estourada)", async () => {
    const service = makeService([
      mov("entrada", 5000, new Date(2026, 5, 1, 12)),
      mov("saida", 1000, new Date(2026, 5, 5, 12)),
      mov("economia", 1000, new Date(2026, 5, 8, 12)), // 20% da renda
    ]);

    const sugestoes = await service.getSugestoes("u1", "2026-06");

    expect(sugestoes).toHaveLength(0);
  });
});
