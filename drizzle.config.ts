import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Dono das migrations desde a introdução do Drizzle (ADR-0014). O schema em
// src/db/schema.ts nasceu por introspecção do banco vivo (drizzle-kit pull) —
// sem mudança de schema físico.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
