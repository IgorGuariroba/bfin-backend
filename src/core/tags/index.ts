export type { Tag } from "./types.js";
export type { TagRepo } from "./ports.js";
export {
  makeTagsService,
  TagValidationError,
  TagNotFoundError,
  SystemTagImmutableError,
  type CreateTagInput,
  type TagsService,
} from "./service.js";
export { DEFAULT_SYSTEM_TAGS, CATEGORY_TAGS } from "./taxonomy.js";
