import { makeTagsService } from "../core/tags/index.js";
import { drizzleTagRepo } from "./drizzle/tag-repo.js";

export const tagsService = makeTagsService(drizzleTagRepo);
