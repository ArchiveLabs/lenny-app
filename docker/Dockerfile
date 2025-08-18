# syntax=docker/dockerfile:1.4

# --- Base stage ---
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ ./apps/
COPY packages/ ./packages/
RUN npm install -g pnpm

# --- Install dependencies ---
FROM base AS deps
RUN pnpm install --frozen-lockfile

# --- Build stage ---
FROM deps AS builder
ARG APP
RUN if [ -z "$APP" ]; then echo "ERROR: APP build argument not set" && exit 1; fi
WORKDIR /app/apps/$APP
RUN pnpm install --frozen-lockfile
RUN pnpm build

# --- Production image ---
FROM node:20-alpine AS runner
ARG APP
WORKDIR /app/apps/$APP
ENV NODE_ENV=production
# Copy the built app directory (includes .next, package.json, app-specific node_modules symlinks)
COPY --from=builder /app/apps/$APP ./
# Copy pnpm global store to satisfy symlinks inside app node_modules
COPY --from=builder /root/.local/share/pnpm /root/.local/share/pnpm
# Also copy root node_modules so pnpm symlinks resolve (provides next binary)
COPY --from=deps /app/node_modules /app/node_modules
EXPOSE 3000
CMD ["npm", "start"]
