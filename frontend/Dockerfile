# Afarensis Enterprise Frontend Dockerfile
# Professional React application with enterprise-grade build process

# Build stage
FROM node:18-alpine as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine as production

# Install curl for health checks
RUN apk --no-cache add curl

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create nginx user
RUN addgroup -g 1001 -S afarensis && \
    adduser -S -u 1001 -G afarensis afarensis

# Set permissions
RUN chown -R afarensis:afarensis /usr/share/nginx/html && \
    chown -R afarensis:afarensis /var/cache/nginx && \
    chown -R afarensis:afarensis /var/log/nginx && \
    chown -R afarensis:afarensis /etc/nginx/conf.d

RUN touch /var/run/nginx.pid && \
    chown -R afarensis:afarensis /var/run/nginx.pid

# Switch to non-root user
USER afarensis

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Development stage
FROM node:18-alpine as development

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies including dev dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose development port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
