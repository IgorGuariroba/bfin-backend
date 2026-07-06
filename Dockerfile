# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
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
CMD ["node", "dist/server.js"]
