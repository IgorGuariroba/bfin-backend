# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# npm 12: o npm que vem no node:22-alpine (10.x) e o 11 podam os pacotes de
# plataforma opcionais do lock e depois rejeitam o próprio resultado
# (`Missing: @esbuild/... from lock file`). O Dependabot gera o lock no formato
# podado, então com 10/11 o build quebra em todo bump dele. Mesmo pin no CI
# (.github/workflows/ci.yml).
ARG NPM_VERSION=12.2.0
RUN npm install -g npm@${NPM_VERSION}
# --ignore-scripts: o prepare (lefthook install) é só para dev e quebraria aqui.
# cache mount: reaproveita o cache do npm entre builds sem inflar a layer.
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

COPY package*.json ./
ARG NPM_VERSION=12.2.0
RUN npm install -g npm@${NPM_VERSION}
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts
COPY --from=builder --chown=fastify:nodejs /app/dist ./dist
COPY --chown=fastify:nodejs scripts/db-migrate.mjs ./scripts/db-migrate.mjs
COPY --chown=fastify:nodejs drizzle ./drizzle
COPY --chown=fastify:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER fastify
EXPOSE 3001
ENV PORT=3001
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "--import", "./dist/otel.js", "dist/server.js"]
