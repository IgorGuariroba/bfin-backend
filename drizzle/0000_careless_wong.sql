CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Previsao" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"amount" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Tag" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "Transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"amount" double precision NOT NULL,
	"date" timestamp(3) NOT NULL,
	"repeat" text DEFAULT 'none' NOT NULL,
	"repeatEnd" text DEFAULT 'forever' NOT NULL,
	"repeatCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"externalId" text,
	"pluggyItemId" text,
	"source" text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PluggyItem" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"itemId" text NOT NULL,
	"connector" text NOT NULL,
	"status" text NOT NULL,
	"lastSyncedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"connectedByUserId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AccountMember" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"memberId" text,
	"inviteEmail" text NOT NULL,
	"inviteToken" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ApiKey" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"hashedKey" text NOT NULL,
	"prefix" text NOT NULL,
	"lastUsedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"revokedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "PlanConfig" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"monthlyAmount" double precision DEFAULT 14.9 NOT NULL,
	"annualAmount" double precision DEFAULT 119.9 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PostTopic" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "WhatsappContact" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "WhatsappConversation" (
	"id" text PRIMARY KEY NOT NULL,
	"contactId" text NOT NULL,
	"status" text DEFAULT 'bot' NOT NULL,
	"lastMessageAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "WhatsappMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"conversationId" text NOT NULL,
	"direction" text NOT NULL,
	"sender" text NOT NULL,
	"body" text NOT NULL,
	"wamid" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Post" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"coverImageUrl" text,
	"category" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"metaTitle" text,
	"metaDescription" text,
	"authorId" text NOT NULL,
	"publishedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PostComment" (
	"id" text PRIMARY KEY NOT NULL,
	"postId" text NOT NULL,
	"userId" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" timestamp(3),
	"image" text,
	"password" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"mpSubscriptionId" text,
	"planExpiresAt" timestamp(3),
	"autoBaixaDiario" boolean DEFAULT false NOT NULL,
	"conversionReportedAt" timestamp(3),
	"gclid" text,
	"gbraid" text,
	"wbraid" text
);
--> statement-breakpoint
CREATE TABLE "_TagToTransaction" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_TagToTransaction_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "_PostTopics" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_PostTopics_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Previsao" ADD CONSTRAINT "Previsao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pluggyItemId_fkey" FOREIGN KEY ("pluggyItemId") REFERENCES "public"."PluggyItem"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PluggyItem" ADD CONSTRAINT "PluggyItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PluggyItem" ADD CONSTRAINT "PluggyItem_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AccountMember" ADD CONSTRAINT "AccountMember_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AccountMember" ADD CONSTRAINT "AccountMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "WhatsappConversation" ADD CONSTRAINT "WhatsappConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."WhatsappContact"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."WhatsappConversation"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_TagToTransaction" ADD CONSTRAINT "_TagToTransaction_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Tag"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_TagToTransaction" ADD CONSTRAINT "_TagToTransaction_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Transaction"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_PostTopics" ADD CONSTRAINT "_PostTopics_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Post"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_PostTopics" ADD CONSTRAINT "_PostTopics_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."PostTopic"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session" USING btree ("sessionToken");--> statement-breakpoint
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken" USING btree ("identifier","token");--> statement-breakpoint
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag" USING btree ("userId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account" USING btree ("provider","providerAccountId");--> statement-breakpoint
CREATE UNIQUE INDEX "Transaction_externalId_key" ON "Transaction" USING btree ("externalId");--> statement-breakpoint
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction" USING btree ("userId","date");--> statement-breakpoint
CREATE INDEX "Transaction_userId_type_idx" ON "Transaction" USING btree ("userId","type");--> statement-breakpoint
CREATE INDEX "PluggyItem_connectedByUserId_idx" ON "PluggyItem" USING btree ("connectedByUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "PluggyItem_itemId_key" ON "PluggyItem" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "PluggyItem_userId_idx" ON "PluggyItem" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "AccountMember_inviteToken_key" ON "AccountMember" USING btree ("inviteToken");--> statement-breakpoint
CREATE INDEX "AccountMember_memberId_idx" ON "AccountMember" USING btree ("memberId");--> statement-breakpoint
CREATE INDEX "AccountMember_ownerId_idx" ON "AccountMember" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX "ApiKey_hashedKey_key" ON "ApiKey" USING btree ("hashedKey");--> statement-breakpoint
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "PostTopic_name_key" ON "PostTopic" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "PostTopic_slug_key" ON "PostTopic" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "WhatsappContact_phone_key" ON "WhatsappContact" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "WhatsappConversation_contactId_key" ON "WhatsappConversation" USING btree ("contactId");--> statement-breakpoint
CREATE INDEX "WhatsappConversation_status_lastMessageAt_idx" ON "WhatsappConversation" USING btree ("status","lastMessageAt");--> statement-breakpoint
CREATE INDEX "WhatsappMessage_conversationId_createdAt_idx" ON "WhatsappMessage" USING btree ("conversationId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "WhatsappMessage_wamid_key" ON "WhatsappMessage" USING btree ("wamid");--> statement-breakpoint
CREATE INDEX "Post_category_status_idx" ON "Post" USING btree ("category","status");--> statement-breakpoint
CREATE UNIQUE INDEX "Post_slug_key" ON "Post" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "Post_status_publishedAt_idx" ON "Post" USING btree ("status","publishedAt");--> statement-breakpoint
CREATE INDEX "PostComment_postId_status_createdAt_idx" ON "PostComment" USING btree ("postId","status","createdAt");--> statement-breakpoint
CREATE INDEX "PostComment_status_createdAt_idx" ON "PostComment" USING btree ("status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE INDEX "_TagToTransaction_B_index" ON "_TagToTransaction" USING btree ("B");--> statement-breakpoint
CREATE INDEX "_PostTopics_B_index" ON "_PostTopics" USING btree ("B");
