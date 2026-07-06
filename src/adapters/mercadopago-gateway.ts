import { PreApproval } from "mercadopago";
import type { PreApprovalRequest } from "mercadopago/dist/clients/preApproval/commonTypes.js";
import { mpClient } from "../lib/mercadopago.js";
import type { PaymentGateway } from "../core/billing/index.js";

/** Implementação MercadoPago da porta PaymentGateway (ADR-0013). */
export const mercadoPagoGateway: PaymentGateway = {
  createSubscription: async (input) => {
    const preApproval = new PreApproval(mpClient);
    const sub = await preApproval.create({
      body: {
        reason: input.reason,
        payer_email: input.payerEmail,
        auto_recurring: {
          frequency: input.cycle === "annual" ? 12 : 1,
          frequency_type: "months",
          transaction_amount: input.amount,
          currency_id: "BRL",
        },
        back_url: input.backUrl,
        notification_url: input.notificationUrl,
        external_reference: input.externalReference,
        // O tipo do SDK do Mercado Pago não cobre notification_url no body do
        // PreApproval, embora a API aceite. Cast localizado em vez de any solto.
      } as PreApprovalRequest,
    });
    return { initPoint: sub.init_point };
  },

  getSubscription: async (id) => {
    const preApproval = new PreApproval(mpClient);
    const sub = await preApproval.get({ id });
    const txAmount = (
      sub as { auto_recurring?: { transaction_amount?: number } }
    ).auto_recurring?.transaction_amount;
    return {
      id: sub.id,
      status: sub.status,
      externalReference: sub.external_reference,
      transactionAmount: txAmount,
    };
  },

  cancelSubscription: async (id) => {
    const preApproval = new PreApproval(mpClient);
    await preApproval.update({ id, body: { status: "cancelled" } });
  },
};
