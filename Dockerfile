# Multi-stage build for Cloud Run: install + build in a full Node image, then
# run on the slim `standalone` output (next.config.ts: output: "standalone")
# so the final image only ships what's needed to serve the app.

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No secrets at build time — Gemini/Groq/MCP env vars are read at request
# time on Cloud Run, not baked into the build.
RUN pnpm build

# Distroless: just the Node runtime, no shell/apt/package manager — far fewer
# OS-level CVEs than node:22-slim, since there's no OS package surface to patch.
FROM gcr.io/distroless/nodejs22-debian12 AS runner
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run injects PORT; Next's standalone server.js honors it.
ENV PORT=8080

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080
CMD ["server.js"]
