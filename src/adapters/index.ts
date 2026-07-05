import { makeTagsService } from "../core/tags/index.js";
import { makeTransactionsService } from "../core/transactions/index.js";
import { makePrevisaoService } from "../core/previsao/index.js";
import { makeIdentityService, makeMembersService } from "../core/identity/index.js";
import { makeApiKeysService } from "../core/apikeys/index.js";
import { drizzleTagRepo } from "./drizzle/tag-repo.js";
import { drizzleTransactionRepo } from "./drizzle/transaction-repo.js";
import { drizzlePrevisaoRepo } from "./drizzle/previsao-repo.js";
import { drizzleIdentityRepo } from "./drizzle/identity-repo.js";
import { drizzleMembersRepo } from "./drizzle/members-repo.js";
import { drizzleApiKeyRepo } from "./drizzle/apikey-repo.js";
import { generateApiKey, hashApiKey } from "../lib/api-key.js";

export const tagsService = makeTagsService(drizzleTagRepo);
export const transactionsService = makeTransactionsService(drizzleTransactionRepo, {
  logger: { warn: (data, msg) => console.warn(msg, data) },
});
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
