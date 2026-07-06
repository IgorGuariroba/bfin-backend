import {
  pgTable,
  timestamp,
  text,
  integer,
  uniqueIndex,
  foreignKey,
  doublePrecision,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const session = pgTable(
  "Session",
  {
    id: text().primaryKey().notNull(),
    sessionToken: text().notNull(),
    userId: text().notNull(),
    expires: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("Session_sessionToken_key").using(
      "btree",
      table.sessionToken.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Session_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const verificationToken = pgTable(
  "VerificationToken",
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("VerificationToken_identifier_token_key").using(
      "btree",
      table.identifier.asc().nullsLast().op("text_ops"),
      table.token.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("VerificationToken_token_key").using(
      "btree",
      table.token.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const previsao = pgTable(
  "Previsao",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    name: text().notNull(),
    amount: doublePrecision().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Previsao_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const tag = pgTable(
  "Tag",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    name: text().notNull(),
    color: text().notNull(),
    isSystem: boolean().default(false).notNull(),
  },
  (table) => [
    uniqueIndex("Tag_userId_name_key").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Tag_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const account = pgTable(
  "Account",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text(),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (table) => [
    uniqueIndex("Account_provider_providerAccountId_key").using(
      "btree",
      table.provider.asc().nullsLast().op("text_ops"),
      table.providerAccountId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Account_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const transaction = pgTable(
  "Transaction",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    type: text().notNull(),
    description: text().notNull(),
    amount: doublePrecision().notNull(),
    date: timestamp({ precision: 3, mode: "string" }).notNull(),
    repeat: text().default("none").notNull(),
    repeatEnd: text().default("forever").notNull(),
    repeatCount: integer().default(0).notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    externalId: text(),
    pluggyItemId: text(),
    source: text().default("manual").notNull(),
  },
  (table) => [
    uniqueIndex("Transaction_externalId_key").using(
      "btree",
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
    index("Transaction_userId_date_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.date.asc().nullsLast().op("timestamp_ops"),
    ),
    index("Transaction_userId_type_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.type.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Transaction_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.pluggyItemId],
      foreignColumns: [pluggyItem.id],
      name: "Transaction_pluggyItemId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
  ],
);

export const pluggyItem = pgTable(
  "PluggyItem",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    itemId: text().notNull(),
    connector: text().notNull(),
    status: text().notNull(),
    lastSyncedAt: timestamp({ precision: 3, mode: "string" }),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    connectedByUserId: text().notNull(),
  },
  (table) => [
    index("PluggyItem_connectedByUserId_idx").using(
      "btree",
      table.connectedByUserId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("PluggyItem_itemId_key").using(
      "btree",
      table.itemId.asc().nullsLast().op("text_ops"),
    ),
    index("PluggyItem_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "PluggyItem_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.connectedByUserId],
      foreignColumns: [user.id],
      name: "PluggyItem_connectedByUserId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const accountMember = pgTable(
  "AccountMember",
  {
    id: text().primaryKey().notNull(),
    ownerId: text().notNull(),
    memberId: text(),
    inviteEmail: text().notNull(),
    inviteToken: text().notNull(),
    role: text().default("editor").notNull(),
    status: text().default("pending").notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("AccountMember_inviteToken_key").using(
      "btree",
      table.inviteToken.asc().nullsLast().op("text_ops"),
    ),
    index("AccountMember_memberId_idx").using(
      "btree",
      table.memberId.asc().nullsLast().op("text_ops"),
    ),
    index("AccountMember_ownerId_idx").using(
      "btree",
      table.ownerId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [user.id],
      name: "AccountMember_ownerId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [user.id],
      name: "AccountMember_memberId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const apiKey = pgTable(
  "ApiKey",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    name: text().notNull(),
    hashedKey: text().notNull(),
    prefix: text().notNull(),
    lastUsedAt: timestamp({ precision: 3, mode: "string" }),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    revokedAt: timestamp({ precision: 3, mode: "string" }),
  },
  (table) => [
    uniqueIndex("ApiKey_hashedKey_key").using(
      "btree",
      table.hashedKey.asc().nullsLast().op("text_ops"),
    ),
    index("ApiKey_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "ApiKey_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const planConfig = pgTable("PlanConfig", {
  id: text().default("default").primaryKey().notNull(),
  monthlyAmount: doublePrecision().default(14.9).notNull(),
  annualAmount: doublePrecision().default(119.9).notNull(),
  updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
});

export const postTopic = pgTable(
  "PostTopic",
  {
    id: text().primaryKey().notNull(),
    slug: text().notNull(),
    name: text().notNull(),
  },
  (table) => [
    uniqueIndex("PostTopic_name_key").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("PostTopic_slug_key").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const post = pgTable(
  "Post",
  {
    id: text().primaryKey().notNull(),
    slug: text().notNull(),
    title: text().notNull(),
    excerpt: text().notNull(),
    content: text().notNull(),
    coverImageUrl: text(),
    category: text().notNull(),
    status: text().default("draft").notNull(),
    metaTitle: text(),
    metaDescription: text(),
    authorId: text().notNull(),
    publishedAt: timestamp({ precision: 3, mode: "string" }),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    index("Post_category_status_idx").using(
      "btree",
      table.category.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("Post_slug_key").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
    index("Post_status_publishedAt_idx").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
      table.publishedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "Post_authorId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
  ],
);

export const postComment = pgTable(
  "PostComment",
  {
    id: text().primaryKey().notNull(),
    postId: text().notNull(),
    userId: text().notNull(),
    body: text().notNull(),
    status: text().default("pending").notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("PostComment_postId_status_createdAt_idx").using(
      "btree",
      table.postId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("PostComment_status_createdAt_idx").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: "PostComment_postId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "PostComment_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const user = pgTable(
  "User",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: timestamp({ precision: 3, mode: "string" }),
    image: text(),
    password: text(),
    plan: text().default("free").notNull(),
    mpSubscriptionId: text(),
    planExpiresAt: timestamp({ precision: 3, mode: "string" }),
    autoBaixaDiario: boolean().default(false).notNull(),
    conversionReportedAt: timestamp({ precision: 3, mode: "string" }),
    gclid: text(),
    gbraid: text(),
    wbraid: text(),
  },
  (table) => [
    uniqueIndex("User_email_key").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const tagToTransaction = pgTable(
  "_TagToTransaction",
  {
    a: text("A").notNull(),
    b: text("B").notNull(),
  },
  (table) => [
    index().using("btree", table.b.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.a],
      foreignColumns: [tag.id],
      name: "_TagToTransaction_A_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.b],
      foreignColumns: [transaction.id],
      name: "_TagToTransaction_B_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.a, table.b],
      name: "_TagToTransaction_AB_pkey",
    }),
  ],
);

export const postTopics = pgTable(
  "_PostTopics",
  {
    a: text("A").notNull(),
    b: text("B").notNull(),
  },
  (table) => [
    index().using("btree", table.b.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.a],
      foreignColumns: [post.id],
      name: "_PostTopics_A_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.b],
      foreignColumns: [postTopic.id],
      name: "_PostTopics_B_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({ columns: [table.a, table.b], name: "_PostTopics_AB_pkey" }),
  ],
);
