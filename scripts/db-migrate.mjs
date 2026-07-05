// Migrações do banco — drizzle-kit é o dono desde a introdução (ADR-0014).
// Roda em todo start (entrypoint/CI/predev); é idempotente.
//
// Baseline: bancos provisionados na era Prisma (dev e prod — o volume
// bfin-app_pgdata é vivo) já contêm todo o DDL da migration 0000 (gerada por
// introspecção, sem mudança de schema físico). Nesses bancos a 0000 é marcada
// como aplicada sem executar; bancos novos rodam a 0000 normalmente. O formato
// do journal (drizzle.__drizzle_migrations: hash sha256 do .sql + created_at =
// `when` do meta/_journal.json; aplica quando created_at < folderMillis) espelha
// drizzle-orm/pg-core/dialect.js — versão pinada no package.json.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  const { rows: [{ t: hasUserTable }] } = await pool.query(
    `select to_regclass('public."User"') as t`
  );
  const journal = await pool
    .query(`select count(*)::int as n from drizzle.__drizzle_migrations`)
    .catch(() => null); // schema/tabela ainda não existem

  if (hasUserTable !== null && (journal === null || journal.rows[0].n === 0)) {
    const { entries } = JSON.parse(
      readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8")
    );
    const first = entries[0];
    const sqlText = readFileSync(join(migrationsFolder, `${first.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(sqlText).digest("hex");

    await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await pool.query(
      `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`
    );
    await pool.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [hash, first.when]
    );
    console.log(`[db-migrate] baseline: ${first.tag} marcada como aplicada (banco pré-existente)`);
  }

  await migrate(drizzle(pool), { migrationsFolder });
  console.log("[db-migrate] migrações em dia");
} finally {
  await pool.end();
}
