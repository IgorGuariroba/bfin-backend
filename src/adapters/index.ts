import { makeTagsService } from "../core/tags/index.js";
import { makeTransactionsService } from "../core/transactions/index.js";
import { makePrevisaoService } from "../core/previsao/index.js";
import {
  makeIdentityService,
  makeMembersService,
} from "../core/identity/index.js";
import { makeApiKeysService } from "../core/apikeys/index.js";
import { makeBillingService } from "../core/billing/index.js";
import { makeInsightsService } from "../core/insights/index.js";
import { drizzleTagRepo } from "./drizzle/tag-repo.js";
import { drizzleTransactionRepo } from "./drizzle/transaction-repo.js";
import { drizzlePrevisaoRepo } from "./drizzle/previsao-repo.js";
import { drizzleIdentityRepo } from "./drizzle/identity-repo.js";
import { drizzleMembersRepo } from "./drizzle/members-repo.js";
import { drizzleApiKeyRepo } from "./drizzle/apikey-repo.js";
import { drizzleBillingRepo } from "./drizzle/billing-repo.js";
import { drizzleInsightsRepo } from "./drizzle/insights-repo.js";
import { generateApiKey, hashApiKey } from "../lib/api-key.js";
import { mercadoPagoGateway } from "./mercadopago-gateway.js";
import { notifyNewSubscriptionOnDiscord } from "./discord-notify.js";
import {
  isGoogleAdsConfigured,
  resolveClickId,
  uploadConversion,
} from "../lib/google-ads.js";

export const tagsService = makeTagsService(drizzleTagRepo);
export const transactionsService = makeTransactionsService(
  drizzleTransactionRepo,
  {
    logger: { warn: (data, msg) => console.warn(msg, data) },
    // Injeta a consulta de Tags do service de Tags (não do repo): é listTags que
    // semeia as Tags de sistema antes de listar — invariante da sugestão por
    // categoria. Padrão de injeção entre domínios, como getUserPlan em members.
    listTags: (userId) => tagsService.listTags(userId),
  },
);
export const previsaoService = makePrevisaoService(drizzlePrevisaoRepo);
export const identityService = makeIdentityService(drizzleIdentityRepo);
export const membersService = makeMembersService(drizzleMembersRepo, {
  getUserPlan: identityService.getUserPlan,
});
export const apiKeysService = makeApiKeysService(drizzleApiKeyRepo, {
  getUserPlan: identityService.getUserPlan,
  generateKey: generateApiKey,
  hashKey: hashApiKey,
  logger: {
    info: (data, msg) => console.info(msg, data),
    warn: (data, msg) => console.warn(msg, data),
  },
});
export const billingService = makeBillingService(
  drizzleBillingRepo,
  mercadoPagoGateway,
  {
    logger: {
      warn: (data, msg) => console.warn(msg, data),
      error: (data, msg) => console.error(msg, data),
    },
    conversions: {
      isConfigured: isGoogleAdsConfigured,
      resolveClickId,
      upload: uploadConversion,
    },
    notifyNewSubscription: notifyNewSubscriptionOnDiscord,
  },
);
export const insightsService = makeInsightsService(drizzleInsightsRepo);
