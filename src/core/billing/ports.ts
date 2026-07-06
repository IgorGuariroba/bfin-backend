import type {
  ActivatedUser,
  BillingCycle,
  ClickAttribution,
  PlanConfigRecord,
  SubscriptionInfo,
} from "./types.js";

/**
 * Porta de persistência do agregado Billing (ADR-0013). Contrato moldado pelo
 * service — não é um CRUD genérico.
 */
export interface BillingRepo {
  /** Config corrente; cria a linha default (14.9/119.9) se ainda não existir. */
  getPlanConfig(): Promise<PlanConfigRecord>;
  updatePlanConfig(
    monthlyAmount: number,
    annualAmount: number,
  ): Promise<PlanConfigRecord>;
  /** null quando o usuário não existe. */
  findSubscription(userId: string): Promise<SubscriptionInfo | null>;
  /** Desvincula a assinatura (mpSubscriptionId = null) sem mexer no plano. */
  clearSubscription(userId: string): Promise<void>;
  /** Ativa o pro (plan/planExpiresAt/mpSubscriptionId) e retorna o que o pós-ativação precisa. */
  activatePro(
    userId: string,
    planExpiresAt: Date,
    mpSubscriptionId: string | null,
  ): Promise<ActivatedUser>;
  /** Grava os click ids só se o User ainda não tiver nenhum (não sobrescreve atribuição prévia). */
  captureClickAttribution(
    userId: string,
    click: ClickAttribution,
  ): Promise<void>;
  conversionAlreadyReported(userId: string): Promise<boolean>;
  markConversionReported(userId: string): Promise<void>;
}

/**
 * Porta do gateway de pagamento (MercadoPago hoje). A validação de assinatura
 * do webhook NÃO passa por aqui — é responsabilidade do adapter HTTP.
 */
export interface PaymentGateway {
  createSubscription(input: {
    reason: string;
    payerEmail: string;
    cycle: BillingCycle;
    amount: number;
    backUrl: string;
    notificationUrl: string;
    externalReference: string;
  }): Promise<{ initPoint: string | undefined }>;
  getSubscription(id: string): Promise<{
    id: string | undefined;
    status: string | undefined;
    externalReference: string | undefined;
    transactionAmount: number | undefined;
  }>;
  cancelSubscription(id: string): Promise<void>;
}
