# ============================================================
# Stage 1: Build Frontend
# ============================================================
FROM docker.arvancloud.ir/node:20-slim AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN test -f index.html || (echo "❌ frontend/index.html missing" && exit 1)
RUN test -f src/main.jsx || (echo "❌ frontend/src/main.jsx missing" && exit 1)
RUN npm run build

# ============================================================
# Stage 2: Install Backend Production Dependencies
# ============================================================
FROM docker.arvancloud.ir/node:20-slim AS backend-deps

WORKDIR /build/backend

COPY backend/package*.json ./
RUN rm -rf node_modules package-lock.json && \
    npm install --omit=dev --force && \
    npm cache clean --force

# ============================================================
# Stage 3: Final Runtime Image
# ============================================================
FROM docker.arvancloud.ir/node:20-slim AS runtime

# نصب کتابخانه‌های موردنیاز درایور ScyllaDB (libssl3 برای OpenSSL 3)
# و ابزارهای پایه (tini, ca-certificates)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        tini \
        ca-certificates \
        libssl3 \
        libstdc++6 \
        zlib1g && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-deps /build/backend/node_modules ./node_modules
COPY backend/package*.json ./
COPY backend/src ./src

COPY --from=frontend-builder /build/frontend/dist ./public

RUN test -f public/index.html || (echo "❌ Build failed: public/index.html not found" && exit 1)

# بررسی صحت بارگذاری کتابخانه‌ی SSL قبل از اجرا
RUN ldconfig -p | grep libssl.so.3 || (echo "❌ libssl3 not found!" && exit 1)

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]