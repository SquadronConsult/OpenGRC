# --- API build ---
FROM node:20-bookworm-slim AS api-build
WORKDIR /app/api
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci
COPY apps/api/ ./
RUN npm run build

# --- Web build ---
FROM node:20-bookworm-slim AS web-build
WORKDIR /app/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
ENV NEXT_PUBLIC_API_URL=proxy
ENV INTERNAL_API_URL=http://127.0.0.1:3000
RUN npm run build

# --- Runtime: PostgreSQL + Node (API + Next.js) ---
FROM postgres:16-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_USER=grc
ENV POSTGRES_PASSWORD=grc
ENV POSTGRES_DB=grc
ENV DB_TYPE=postgres
ENV DB_HOST=127.0.0.1
ENV DB_PORT=5432
ENV DB_USER=grc
ENV DB_PASSWORD=grc
ENV DB_NAME=grc
ENV DB_SYNC=false
ENV DB_MIGRATIONS_RUN=true
ENV NODE_ENV=production
ENV PORT=3000
ENV INTERNAL_API_URL=http://127.0.0.1:3000
ENV NEXT_PUBLIC_API_URL=proxy

WORKDIR /app

COPY --from=api-build /app/api/dist ./api/dist
COPY --from=api-build /app/api/package.json ./api/package.json
COPY --from=api-build /app/api/package-lock.json ./api/package-lock.json
RUN cd api && npm ci --omit=dev

COPY --from=web-build /app/web/.next ./web/.next
COPY --from=web-build /app/web/public ./web/public
COPY --from=web-build /app/web/package.json ./web/package.json
COPY --from=web-build /app/web/package-lock.json ./web/package-lock.json
COPY --from=web-build /app/web/next.config.mjs ./web/next.config.mjs
RUN cd web && npm ci --omit=dev

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
VOLUME ["/var/lib/postgresql/data"]
ENTRYPOINT ["/entrypoint.sh"]
