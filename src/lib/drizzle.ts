import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../db/schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

// Sem este handler, um cliente idle que perde a conexão (ex.: restart do
// Postgres) emite 'error' não capturado e derruba o processo inteiro.
pool.on("error", (err) => {
  console.error("pg pool: erro em cliente idle", err.message);
});

export const db = drizzle(pool, { schema });
