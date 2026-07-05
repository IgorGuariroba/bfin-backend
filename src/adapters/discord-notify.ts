import type { NewSubscriptionInfo } from "../core/billing/index.js";

/**
 * Aviso de nova assinatura no Discord. Fire-and-forget: o webhook do
 * MercadoPago precisa responder 200 — falha aqui só loga.
 */
export function notifyNewSubscriptionOnDiscord(info: NewSubscriptionInfo): void {
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!discordUrl) return;

  const label = info.cycle === "annual" ? "Anual (R$ 119,90)" : "Mensal (R$ 14,90)";
  fetch(discordUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "Nova assinatura bfin Pro",
          color: 0x22c55e,
          fields: [
            { name: "Usuário", value: info.email, inline: true },
            { name: "Plano", value: label, inline: true },
            {
              name: "Expira em",
              value: info.planExpiresAt.toLocaleDateString("pt-BR"),
              inline: true,
            },
            { name: "Subscription ID", value: info.subscriptionId ?? "-", inline: false },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch((e) => console.error("[discord] notify failed:", e));
}
