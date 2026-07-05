export type {
  Movement,
  MonthSummary,
  SaldoDia,
  SaldosResult,
  Sugestao,
  SugestaoTipo,
  TotaisResult,
} from "./types.js";
export type { InsightsRepo, MovementRange } from "./ports.js";
export {
  makeInsightsService,
  InsightsValidationError,
  type InsightsService,
} from "./service.js";
