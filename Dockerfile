# ─────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --frozen-lockfile

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# Prune dev dependencies
RUN npm prune --production


# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S midnight -u 1001

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built artifacts
COPY --from=builder --chown=midnight:nodejs /app/dist ./dist
COPY --from=builder --chown=midnight:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=midnight:nodejs /app/prisma ./prisma
COPY --chown=midnight:nodejs package.json ./

USER midnight

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
