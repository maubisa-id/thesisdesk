# ── thesis-next: Dockerfile multi-stage (Next.js standalone) ─────────────────
# Image ramping untuk deploy institusi. Butuh `output: "standalone"` di next.config.
# Build: docker build -t thesis-next .
# Jalan (SQLite, sekali coba): docker run -p 3100:3100 thesis-next
# Produksi (MySQL): pakai docker-compose.yml.

# 1) Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# 2) Build
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client + provider sesuai DB_PROVIDER (default sqlite; set mysql via build-arg/env)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# 3) Runtime (non-root, minimal)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
RUN apk add --no-cache openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Output standalone + aset publik + skema Prisma (untuk migrate saat start)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3100
CMD ["node", "server.js"]
