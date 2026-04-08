# ── Stage 1: Install dependencies ────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --production --ignore-scripts && npm cache clean --force

# ── Stage 2: Production image ────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Copy dependencies from build stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create uploads directory owned by app user
RUN mkdir -p uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health/live || exit 1

CMD ["node", "src/index.js"]
