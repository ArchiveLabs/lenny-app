# syntax=docker/dockerfile:1.4

FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

FROM base AS deps
RUN pnpm install --frozen-lockfile --filter web...

FROM deps AS builder
RUN pnpm --filter web... build

FROM node:22-alpine AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN corepack enable

WORKDIR /app

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/web ./apps/web

# Don't run as root: a bug in the app should not be a bug in the container.
USER node

EXPOSE 3000

# Start Next directly: going through pnpm would try to download pnpm for this user at startup.
WORKDIR /app/apps/web
CMD ["./node_modules/.bin/next", "start"]
