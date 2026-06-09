FROM node:22-slim AS builder
WORKDIR /app

# 国内镜像加速 + 安装 OpenSSL（Prisma 需要）
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-timeout 120000 && \
    apt-get update -y && apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# 先装依赖，利用 docker layer 缓存
COPY package.json ./
RUN npm install && \
    npm cache clean --force

# 复制源码
COPY . .

# Prisma 引擎 + 构建
RUN ./node_modules/.bin/prisma generate
RUN npm run build

# ---- Production image ----
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma 引擎文件（standalone 需要）
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/adapter-pg ./node_modules/@prisma/adapter-pg
COPY --from=builder /app/node_modules/@prisma/pg-worker ./node_modules/@prisma/pg-worker
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
