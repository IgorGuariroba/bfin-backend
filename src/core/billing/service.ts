import type { BillingRepo, PaymentGateway } from "./ports.js";
import type {
  BillingCycle,
  ClickAttribution,
  PlanConfigRecord,
  SubscriptionInfo,
} from "./types.js";

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Mensal",
  annual: "Anual",
};

export class BillingValidationError extends Error {}

/** Lançada quando uma mutação de billing não encontra o User esperado. */
export class BillingUserNotFoundError extends Error {}

export interface BillingLogger {
  warn(data: Record<string, unknown>, msg: string): void;
  error(data: Record<string, unknown>, msg: string): void;
}

/** Identificador de clique já resolvido para envio de conversão (ADR-0010). */
export interface ResolvedClickId {
  type: "gclid" | "gbraid" | "wbraid";
  value: string;
}

/** Integração de conversões de marketing — implementada fora do core (Google Ads). */
export interface ConversionReporter {
  isConfigured(): boolean;
  resolveClickId(user: ClickSource): ResolvedClickId | null;
  upload(input: {
    clickId: ResolvedClickId;
    value: number;
    occurredAt: Date;
  }): Promise<{ ok: boolean; reason?: string; error?: unknown }>;
}

interface ClickSource {
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
}

export interface NewSubscriptionInfo {
  email: string;
  cycle: BillingCycle | undefined;
  planExpiresAt: Date;
  subscriptionId: string | null;
}

export interface BillingDeps {
  logger: BillingLogger;
  /** Opcional: sem reporter configurado, conversões são simplesmente puladas. */
  conversions?: ConversionReporter;
  /** Opcional: aviso de nova assinatura (Discord hoje). Falha nunca propaga. */
  notifyNewSubscription?: (info: NewSubscriptionInfo) => void | Promise<void>;
}

/** Fallback de valor de conversão quando o gateway não informa o amount. */
const DEFAULT_CONVERSION_AMOUNTS: Record<BillingCycle, number> = {
  monthly: 14.9,
  annual: 119.9,
};

export function makeBillingService(
  repo: BillingRepo,
  gateway: PaymentGateway,
  deps: BillingDeps,
) {
  /** Preços correntes do pro (fonte única: PlanConfig — CONTEXT.md). */
  async function getPlanPrices(): Promise<{ monthly: number; annual: number }> {
    const config = await repo.getPlanConfig();
    return { monthly: config.monthlyAmount, annual: config.annualAmount };
  }

  /** Config completa, para a tela admin. */
  async function getPlanConfig(): Promise<PlanConfigRecord> {
    return repo.getPlanConfig();
  }

  async function updatePlanConfig(input: {
    monthlyAmount: number;
    annualAmount: number;
  }): Promise<PlanConfigRecord> {
    const { monthlyAmount, annualAmount } = input;
    if (typeof monthlyAmount !== "number" || typeof annualAmount !== "number") {
      throw new BillingValidationError("Valores inválidos");
    }
    return repo.updatePlanConfig(monthlyAmount, annualAmount);
  }

  /** Assinatura do próprio usuário; inexistente cai no shape default free. */
  async function getSubscription(userId: string): Promise<SubscriptionInfo> {
    return (
      (await repo.findSubscription(userId)) ?? {
        plan: "free",
        planExpiresAt: null,
        mpSubscriptionId: null,
      }
    );
  }

  /**
   * Cancela a assinatura no gateway e desvincula o mpSubscriptionId. O plano
   * NÃO muda aqui — o downgrade acontece quando planExpiresAt vence
   * (getUserPlan) ou quando o webhook confirmar o cancelamento.
   */
  async function cancelSubscription(userId: string): Promise<void> {
    const sub = await repo.findSubscription(userId);
    if (!sub?.mpSubscriptionId) {
      throw new BillingValidationError("Nenhuma assinatura ativa");
    }
    await gateway.cancelSubscription(sub.mpSubscriptionId);
    await repo.clearSubscription(userId);
  }

  /**
   * Inicia o checkout do pro: cria a assinatura recorrente no gateway com o
   * preço corrente do PlanConfig e devolve o initPoint para redirecionar.
   * A atribuição de marketing (ADR-0010) é melhor-esforço — nunca bloqueia.
   */
  async function checkout(input: {
    userId: string;
    email: string | null | undefined;
    cycle: BillingCycle;
    origin: string;
    click?: ClickAttribution;
  }): Promise<{ initPoint: string | undefined }> {
    const { userId, email, cycle, origin, click } = input;

    if (click && (click.gclid || click.gbraid || click.wbraid)) {
      try {
        await repo.captureClickAttribution(userId, click);
      } catch (err) {
        deps.logger.warn(
          { userId, err },
          "falha ao capturar click id no checkout",
        );
      }
    }

    if (!cycle || !CYCLE_LABELS[cycle]) {
      throw new BillingValidationError("Ciclo inválido");
    }
    if (!email) {
      throw new BillingValidationError("Conta sem e-mail");
    }

    const config = await repo.getPlanConfig();
    const amount =
      cycle === "annual" ? config.annualAmount : config.monthlyAmount;

    return gateway.createSubscription({
      reason: `bfin Pro — ${CYCLE_LABELS[cycle]}`,
      payerEmail: email,
      cycle,
      amount,
      backUrl: `${origin}/assinar`,
      notificationUrl: `${origin}/api/webhook/mercadopago`,
      externalReference: `${userId}:${cycle}`,
    });
  }

  /**
   * Reporta a conversão de assinatura (ADR-0010), uma única vez. Dedup por
   * conversionAlreadyReported descarta renovações (que também chegam como
   * `authorized`) e reenvios do mesmo evento. Falhas nunca propagam — o
   * webhook precisa responder 200 ao gateway.
   */
  async function maybeReportConversion(
    userId: string,
    user: ClickSource,
    cycle: string | undefined,
    txAmount: number | undefined,
  ): Promise<void> {
    const conversions = deps.conversions;
    if (!conversions?.isConfigured()) return;
    const clickId = conversions.resolveClickId(user);
    if (!clickId) return;

    try {
      if (await repo.conversionAlreadyReported(userId)) return;

      const fallback =
        cycle === "annual" || cycle === "monthly"
          ? DEFAULT_CONVERSION_AMOUNTS[cycle]
          : DEFAULT_CONVERSION_AMOUNTS.monthly;
      const result = await conversions.upload({
        clickId,
        value: txAmount ?? fallback,
        occurredAt: new Date(),
      });

      if (result.ok) {
        await repo.markConversionReported(userId);
      } else if (result.reason === "error") {
        deps.logger.error(
          { userId, error: result.error },
          "conversion upload failed",
        );
      }
    } catch (err) {
      deps.logger.warn({ userId, err }, "conversion report failed");
    }
  }

  /**
   * Processa um evento de assinatura do gateway (webhook — a validação de
   * assinatura HTTP fica no adapter). `authorized` ativa o pro pela janela do
   * ciclo (upgrade/renovação); `cancelled`/`paused` desvincula a assinatura —
   * o downgrade em si acontece quando planExpiresAt vencer (getUserPlan).
   */
  async function processSubscriptionEvent(
    subscriptionId: string,
  ): Promise<void> {
    const sub = await gateway.getSubscription(subscriptionId);

    const [userId, cycle] = (sub.externalReference ?? "").split(":");
    if (!userId) return;

    if (sub.status === "authorized") {
      const billingDays = cycle === "annual" ? 365 : 30;
      const planExpiresAt = new Date(
        Date.now() + billingDays * 24 * 60 * 60 * 1000,
      );
      const user = await repo.activatePro(
        userId,
        planExpiresAt,
        sub.id ?? null,
      );

      await maybeReportConversion(userId, user, cycle, sub.transactionAmount);

      try {
        await deps.notifyNewSubscription?.({
          email: user.email,
          cycle: cycle === "annual" || cycle === "monthly" ? cycle : undefined,
          planExpiresAt,
          subscriptionId: sub.id ?? null,
        });
      } catch (err) {
        deps.logger.warn({ userId, err }, "subscription notify failed");
      }
    } else if (sub.status === "cancelled" || sub.status === "paused") {
      await repo.clearSubscription(userId);
    }
  }

  return {
    getPlanPrices,
    getPlanConfig,
    updatePlanConfig,
    getSubscription,
    cancelSubscription,
    checkout,
    processSubscriptionEvent,
  };
}

export type BillingService = ReturnType<typeof makeBillingService>;
