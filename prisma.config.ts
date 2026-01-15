import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Prisma v7: URLs de conexão (incluindo migrações) ficam aqui, não mais no schema.prisma.
  // - DIRECT_URL: conexão direta (sem pooler/pgbouncer) recomendada para `prisma migrate deploy`
  // - DATABASE_URL: pode ser pooler (runtime)
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      (() => {
        throw new Error('DIRECT_URL ou DATABASE_URL não está definido');
      })(),
  },
});
