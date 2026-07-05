#!/bin/sh
set -e

# Aplica migrações pendentes antes de subir o servidor (drizzle-kit é o dono
# do schema desde a ADR-0017). Roda em todo start do container; é idempotente.
node scripts/db-migrate.mjs

exec "$@"
