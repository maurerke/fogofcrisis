# ============================================
# CyberCrisis — Multi-Stage Docker Build
# ============================================

# --- Stage 1: Build ---
# Node 24: required for the built-in `node:sqlite` module (DatabaseSync), which the
# DB layer uses for genuinely synchronous queries. node:sqlite is available without a
# flag only from Node 23.4+; Node 20/22 LTS do NOT ship it (ERR_UNKNOWN_BUILTIN_MODULE).
FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json tsconfig.base.json ./

# Copy all workspace package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
COPY packages/frontend/ packages/frontend/

# Build shared types first, then backend and frontend
RUN npm run build -w packages/shared && \
    npm run build -w packages/backend && \
    npm run build -w packages/frontend

# --- Stage 2: Production Runtime ---
FROM node:24-alpine AS runtime

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# We only need backend runtime dependencies
RUN npm ci --omit=dev -w packages/backend -w packages/shared && \
    npm cache clean --force

# Copy compiled backend
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy compiled frontend (served as static files)
COPY --from=builder /app/packages/frontend/dist ./frontend-static

# Copy scenario files
COPY scenarios/ ./scenarios/

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R node:node /app/data

# Switch to non-root user
USER node

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/cybercrisis.sqlite
ENV SCENARIO_PATH=/app/scenarios/ransomware_stadtwerke.json
ENV FRONTEND_STATIC_PATH=/app/frontend-static

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the backend server.
# --disable-warning=ExperimentalWarning silences the once-per-start node:sqlite
# experimental notice so it does not clutter production logs (other warnings stay on).
CMD ["node", "--disable-warning=ExperimentalWarning", "packages/backend/dist/index.js"]
