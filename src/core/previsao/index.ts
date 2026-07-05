export type { Previsao, NewDiario } from "./types.js";
export type { PrevisaoRepo, PrevisaoPatch } from "./ports.js";
export {
  makePrevisaoService,
  PrevisaoValidationError,
  PrevisaoNotFoundError,
  type PrevisaoService,
} from "./service.js";
