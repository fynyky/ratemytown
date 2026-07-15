# Production image for RateMyTown.sg — the Express SSR app only.
# Postgres, Redis and object storage are managed Fly services, not baked in.
FROM node:22-slim AS deps
WORKDIR /app
ENV NODE_ENV=production
# Install only production deps against the committed lockfile for repeatable builds.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# PORT is what Express binds to; fly.toml's internal_port must match.
ENV PORT=8080
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
# Run as the unprivileged user shipped in the base image.
USER node
CMD ["node", "src/server.js"]
