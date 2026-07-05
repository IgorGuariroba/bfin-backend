// Aritmética de datas pura, compartilhada pelo core (ADR-0013). Movida de
// src/lib/date-utils.ts, que re-exporta daqui para os consumidores existentes.
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addWeeks(date: Date, n: number): Date {
  return addDays(date, n * 7);
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Janela [gte, lt) que cobre o dia-calendário corrente em America/São_Paulo,
 * expressa como meia-noites UTC. Os `diario` são gravados ao meio-dia
 * (12:00 no container UTC — ADR-0005), então a janela do dia tem ~9–12h de
 * folga das bordas, imune a off-by-one perto da virada. Default: agora.
 */
export function saoPauloTodayRange(now: Date = new Date()): { gte: Date; lt: Date } {
  // en-CA formata como YYYY-MM-DD; com timeZone, dá a data-calendário em SP.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const lt = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return { gte, lt };
}
