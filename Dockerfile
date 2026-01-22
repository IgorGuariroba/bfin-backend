FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY sdk ./sdk
COPY tsconfig*.json ./
COPY orval.config.ts ./
RUN npx prisma generate
RUN npm run build


FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=root:root --chmod=755 /app/dist ./dist
COPY --from=builder --chown=root:root --chmod=755 /app/node_modules ./node_modules
COPY --from=builder --chown=root:root --chmod=644 /app/package*.json ./
COPY --from=builder --chown=root:root --chmod=755 /app/prisma ./prisma
# ← MUDAR ESTA LINHA (remover --from=builder):
COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh
USER nodejs
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
