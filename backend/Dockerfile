# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including dev) for the build.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Prune dev dependencies for the runtime image.
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache dumb-init

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Render injects PORT at runtime; server.ts reads process.env.PORT.
EXPOSE 4000

# Apply migrations then start the API.
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
