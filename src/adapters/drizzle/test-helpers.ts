import { afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../../lib/drizzle.js";
import { user as userTable } from "../../db/schema.js";

export function trackCreatedUsers() {
  let createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length) {
      await db.delete(userTable).where(inArray(userTable.id, createdUserIds));
      createdUserIds = [];
    }
  });

  return (id: string) => createdUserIds.push(id);
}
