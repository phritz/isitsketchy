# syntax=docker/dockerfile:1

# ---- Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# prisma schema is needed because the `postinstall` script runs `prisma generate`.
COPY prisma ./prisma
RUN npm ci

# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are inlined into the bundle at build time, so the value must
# be present during `next build`. Railway passes service variables to Dockerfile
# builds only via declared ARGs, so declare it here and promote it to an env var.
ARG NEXT_PUBLIC_API_TOKEN
ENV NEXT_PUBLIC_API_TOKEN=$NEXT_PUBLIC_API_TOKEN
# Regenerate the Rust-free Prisma client into the source tree (lib/generated).
RUN npx prisma generate
RUN npm run build

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway injects PORT at runtime; default to 3000 for local `docker run`.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Ensure the generated Prisma client is present in the standalone runtime.
COPY --from=builder --chown=nextjs:nodejs /app/lib/generated ./lib/generated

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
