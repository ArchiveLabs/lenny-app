# syntax=docker/dockerfile:1.4

# --- Base stage ---
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/
RUN npm install -g pnpm

# --- Install dependencies ---
FROM base AS deps
RUN pnpm install --frozen-lockfile

# --- Build stage ---
FROM deps AS builder
WORKDIR /app
RUN pnpm build

# --- Production image ---
FROM node:20-alpine AS runner
ARG APP
WORKDIR /app/apps/$APP
ENV NODE_ENV=production
COPY --from=builder /app/apps/$APP .
COPY --from=deps /app/node_modules /app/node_modules
# Install pnpm and Nginx
RUN npm install -g pnpm && apk add --no-cache nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Expose only port 80 for Nginx
EXPOSE 80

# Start Next.js in the background, then Nginx in the foreground
CMD pnpm start & sleep 5 && nginx -g 'daemon off;'
