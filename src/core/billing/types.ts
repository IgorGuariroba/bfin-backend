// Tipos de domínio próprios (ADR-0013). As rotas serializam estes objetos —
// remover campo é breaking change de API.
export type BillingCycle = "monthly" | "annual";

/** PlanConfig: fonte única de verdade de preço (CONTEXT.md › PlanConfig). */
export interface PlanConfigRecord {
  id: string;
  monthlyAmount: number;
  annualAmount: number;
  updatedAt: Date;
}

/** Projeção de assinatura do User, como /api/subscription responde. */
export interface SubscriptionInfo {
  plan: string;
  planExpiresAt: Date | null;
  mpSubscriptionId: string | null;
}

/** Identificadores de clique do Google Ads capturados no checkout (ADR-0010). */
export interface ClickAttribution {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
}

/** O que o pós-ativação precisa do User (Discord + atribuição de conversão). */
export interface ActivatedUser {
  email: string;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
}
