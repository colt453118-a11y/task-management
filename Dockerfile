# ─── Builder Stage ─────────────────────────────────────────────
FROM node:26-alpine AS builder

# Upgrade corepack to support pnpm@10 signature verification
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Install dependencies (separate from source for layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @workmanagement/web build

# ─── Runner Stage ─────────────────────────────────────────────
FROM node:26-alpine AS runner

# Create non-root user
RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy standalone output (includes server.js + minimal node_modules)
COPY --from=builder --chown=app:app /app/apps/web/.next/standalone ./
# Copy static assets (not included in standalone output)
COPY --from=builder --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
# Copy public assets (if they exist — may be empty/untracked)
COPY --from=builder --chown=app:app /app/apps/web/public/ ./apps/web/public/

# Switch to non-root user
USER app

# Expose port
EXPOSE 3000

# Start standalone server
CMD ["node", "apps/web/server.js"]
