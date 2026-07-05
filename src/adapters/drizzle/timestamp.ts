// Colunas `timestamp` do schema usam mode: 'string' (sem timezone) — o driver
// `pg` (usado por Prisma e Drizzle) serializa/parseia esses valores tratando
// os componentes como UTC, independente do fuso do processo (mesma convenção
// de `date.toISOString()`/`new Date(iso)`). O core lê o instante de volta com
// getters locais (parseTransactionDay etc.); usar componentes locais aqui
// duplicaria o offset do fuso e quebraria o round-trip.
export function toDbTimestamp(d: Date): string {
  return d.toISOString().slice(0, 23).replace("T", " ");
}

export function fromDbTimestamp(s: string): Date {
  return new Date(`${s.replace(" ", "T")}Z`);
}

export function fromDbTimestampOrNull(s: string | null): Date | null {
  return s ? fromDbTimestamp(s) : null;
}
