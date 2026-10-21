FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.6.5 --activate
RUN apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app
ARG APP_NAME
COPY . .
RUN pnpm install --no-frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @hanover/${APP_NAME} build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public
USER nextjs
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD node apps/${APP_NAME}/server.js
