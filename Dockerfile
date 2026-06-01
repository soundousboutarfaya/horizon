# ---- Build stage: install production dependencies (compiles sqlite3 if needed) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Build toolchain in case a prebuilt sqlite3 binary is unavailable for the platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Drop root privileges.
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
