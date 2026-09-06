# Dockerfile
FROM node:22-alpine AS build

ARG APP_VERSION="vDev"
ENV VITE_APP_VERSION=${APP_VERSION}

WORKDIR /build

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci
RUN cd client && npm ci
RUN cd server && npm ci

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Build backend
RUN cd server && npm run build

# Production stage
FROM node:22-alpine

ARG APP_VERSION="vDev"
ENV APP_VERSION=${APP_VERSION}

WORKDIR /app

# Copy package files and install production dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy built backend
COPY --from=build /build/server/dist ./dist

# Create a directory for client files and copy the built frontend
COPY --from=build /build/client/dist ./client/dist

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/health || exit 1

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["node", "dist/index.js"]
