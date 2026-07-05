import { describe, it, expect } from "vitest";
import { db } from "../../lib/drizzle.js";
import { previsao, transaction, user as userTable } from "../../db/schema.js";
import { toDbTimestamp } from "./timestamp.js";
import { insightsService } from "../index.js";
import { trackCreatedUsers } from "./test-helpers.js";

const { getTotais, getSaldos, getMonthSummary, getSugestoes } = insightsService;

const trackUser = trackCreatedUsers();

async function seedUser() {
  const [row] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Insights User",
      email: `insights-${crypto.randomUUID()}@example.com`,
      plan: "pro",
    })
    .returning();
  trackUser(row.id);
  return row;
}

function tx(
  userId: string,
  type: string,
  amount: number,
  date: Date
) {
  const now = toDbTimestamp(new Date());
  return db.insert(transaction).values({
    id: crypto.randomUUID(),
    userId,
    type,
    description: type,
    amount,
    date: toDbTimestamp(date),
    source: "manual",
    updatedAt: now,
  });
}

describe("getTotais", () => {
  it("soma por tipo no mês e deriva custoVida/performance/saldoAtual", async () => {
    const user = await seedUser();
    // junho/2026
    await tx(user.id, "entrada", 5000, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 800, new Date(2026, 5, 5, 12));
    await tx(user.id, "cartao", 200, new Date(2026, 5, 6, 12));
    await tx(user.id, "diario", 100, new Date(2026, 5, 7, 12));
    await tx(user.id, "economia", 300, new Date(2026, 5, 8, 12));

    const t = await getTotais(user.id, "2026-06");

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
    const user = await seedUser();
    // Mês anterior (maio/2026): entrada 2000, custo de vida 500 → performance 1500.
    await tx(user.id, "entrada", 2000, new Date(2026, 4, 2, 12));
    await tx(user.id, "saida", 500, new Date(2026, 4, 3, 12));
    // Mês corrente (junho/2026)
    await tx(user.id, "entrada", 1000, new Date(2026, 5, 2, 12));

    const t = await getTotais(user.id, "2026-06");

    // saldoAnterior = tudo antes de 01/jun = entrada(2000) - saida(500) = 1500
    expect(t.saldoAnterior).toBe(1500);
    expect(t.saldoAtual).toBe(2500); // 1500 + (1000 - 0)
    expect(t.prevMonth).not.toBeNull();
    expect(t.prevMonth?.saldoAtual).toBe(1500); // performance de maio
    expect(t.prevMonth?.custoVida).toBe(500);
  });

  it("rejeita mês malformado", async () => {
    const user = await seedUser();
    const { InsightsValidationError } = await import("../../core/insights/index.js");
    await expect(getTotais(user.id, "2026/06")).rejects.toBeInstanceOf(
      InsightsValidationError
    );
    // mês 00 casa o regex mas é inválido — não pode escapar como NaN.
    await expect(getTotais(user.id, "2026-00")).rejects.toBeInstanceOf(
      InsightsValidationError
    );
  });
});

describe("getSaldos", () => {
  it("acumula saldo dia a dia partindo do saldo dos meses anteriores", async () => {
    const user = await seedUser();
    // Saldo anterior: maio entrada 1000 → prevByType.entrada = 1000.
    await tx(user.id, "entrada", 1000, new Date(2026, 4, 10, 12));
    // Junho: dia 2 gasta 200 (saida); dia 5 entra 500.
    await tx(user.id, "saida", 200, new Date(2026, 5, 2, 12));
    await tx(user.id, "entrada", 500, new Date(2026, 5, 5, 12));

    const { entries, prevByType } = await getSaldos(user.id, "2026-06");

    expect(prevByType.entrada).toBe(1000);
    expect(entries).toHaveLength(30); // junho tem 30 dias
    // Dia 1: sem movimento → saldo segue 1000.
    expect(entries[0].day).toBe(1);
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
    const user = await seedUser();
    await tx(user.id, "entrada", 5000, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 800, new Date(2026, 5, 5, 12));
    await tx(user.id, "cartao", 200, new Date(2026, 5, 6, 12));
    await tx(user.id, "economia", 500, new Date(2026, 5, 8, 12));

    const s = await getMonthSummary(user.id, "2026-06");

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
    const user = await seedUser();
    // Sem saldo anterior; gasta mais do que entra → saldoAtual < 0.
    await tx(user.id, "entrada", 100, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 900, new Date(2026, 5, 2, 12));

    const sugestoes = await getSugestoes(user.id, "2026-06");

    expect(sugestoes.map((s) => s.tipo)).toContain("saldo_negativo");
    const s = sugestoes.find((x) => x.tipo === "saldo_negativo");
    expect(s?.severidade).toBe("alerta");
    expect(s?.texto).toBeTruthy();
  });

  it("aponta diário acima do previsto quando o gasto diário supera a Previsão", async () => {
    const user = await seedUser();
    await db.insert(previsao).values({ id: crypto.randomUUID(), userId: user.id, name: "Variável", amount: 30 });
    // Mês passado (maio): diário acumulado 3000 / 31 dias ≈ 96,7/dia >> previsão 30/31 ≈ 0,97/dia.
    await tx(user.id, "entrada", 9000, new Date(2026, 4, 1, 12)); // mantém saldo positivo
    await tx(user.id, "diario", 3000, new Date(2026, 4, 10, 12));

    const sugestoes = await getSugestoes(user.id, "2026-05");

    expect(sugestoes.map((s) => s.tipo)).toContain("diario_acima");
    expect(sugestoes.map((s) => s.tipo)).not.toContain("saldo_negativo");
  });

  it("aponta economia baixa quando guardou menos de 10% da renda", async () => {
    const user = await seedUser();
    await tx(user.id, "entrada", 5000, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 1000, new Date(2026, 5, 5, 12));
    await tx(user.id, "economia", 100, new Date(2026, 5, 8, 12)); // 2% da renda

    const sugestoes = await getSugestoes(user.id, "2026-06");

    expect(sugestoes.map((s) => s.tipo)).toContain("economia_baixa");
  });

  it("aponta custo de vida em alta quando supera o do mês anterior", async () => {
    const user = await seedUser();
    // Maio: custo de vida 1000.
    await tx(user.id, "entrada", 9000, new Date(2026, 4, 1, 12));
    await tx(user.id, "saida", 1000, new Date(2026, 4, 5, 12));
    // Junho: custo de vida 3000 (subiu), economia saudável, saldo positivo.
    await tx(user.id, "entrada", 9000, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 3000, new Date(2026, 5, 5, 12));
    await tx(user.id, "economia", 2000, new Date(2026, 5, 8, 12));

    const sugestoes = await getSugestoes(user.id, "2026-06");

    expect(sugestoes.map((s) => s.tipo)).toContain("custo_subiu");
  });

  it("não sugere nada num mês saudável (saldo positivo, economia ok, sem previsão estourada)", async () => {
    const user = await seedUser();
    await tx(user.id, "entrada", 5000, new Date(2026, 5, 1, 12));
    await tx(user.id, "saida", 1000, new Date(2026, 5, 5, 12));
    await tx(user.id, "economia", 1000, new Date(2026, 5, 8, 12)); // 20% da renda

    const sugestoes = await getSugestoes(user.id, "2026-06");

    expect(sugestoes).toHaveLength(0);
  });
});
