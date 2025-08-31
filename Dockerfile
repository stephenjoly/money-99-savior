# Dockerfile
FROM node:22-alpine as build

WORKDIR /build

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Build backend
RUN cd server && npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY server/package*.json ./
RUN npm install --only=production

# Copy built backend
COPY --from=build /build/server/dist ./dist

# Create a directory for client files and copy the built frontend
COPY --from=build /build/client/dist ./client/dist

# Add debugging to see what's in the container
RUN echo "Listing /app directory:"
RUN ls -la /app
RUN echo "Listing /app/client directory:"
RUN ls -la /app/client
RUN echo "Listing /app/client/dist directory:"
RUN ls -la /app/client/dist

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["node", "dist/index.js"]