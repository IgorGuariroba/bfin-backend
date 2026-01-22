FROM node:20-alpine AS builder

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts ./
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
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.ts ./
COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh
USER nodejs
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
