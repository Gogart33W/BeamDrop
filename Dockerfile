# Multi-stage Dockerfile for BeamDrop
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies
RUN npm install

# Copy source codes
COPY server ./server
COPY client ./client

# Build server and client
RUN npm run build -w server
RUN npm run build -w client

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Copy root package.json and server package.json
COPY package.json ./
COPY server/package.json ./server/

# Install only production server dependencies
RUN npm install --omit=dev --workspace=server

# Copy built server and client artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 4000

CMD ["node", "server/dist/index.js"]
