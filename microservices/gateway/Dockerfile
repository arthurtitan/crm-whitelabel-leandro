FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package first
COPY shared/package*.json ./shared/
WORKDIR /app/shared
RUN npm ci
COPY shared/ .
RUN npm run build

# Build gateway
WORKDIR /app/gateway
COPY gateway/package*.json ./
RUN npm ci
COPY gateway/ .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy shared
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package*.json ./shared/

# Copy gateway
COPY --from=builder /app/gateway/dist ./dist
COPY --from=builder /app/gateway/package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]
