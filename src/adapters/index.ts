import { makeTagsService } from "../core/tags/index.js";
import { makeTransactionsService } from "../core/transactions/index.js";
import { drizzleTagRepo } from "./drizzle/tag-repo.js";
import { drizzleTransactionRepo } from "./drizzle/transaction-repo.js";

export const tagsService = makeTagsService(drizzleTagRepo);
export const transactionsService = makeTransactionsService(drizzleTransactionRepo, {
  logger: { warn: (data, msg) => console.warn(msg, data) },
});
