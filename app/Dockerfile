FROM node:22-slim AS base
WORKDIR /app

# 国内镜像加速 + 安装 OpenSSL
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-timeout 120000 && \
    apt-get update -y && apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# 装依赖（有 lockfile 用 ci 更快）
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci && npm cache clean --force; else npm install && npm cache clean --force; fi

# 复制源码 + 构建
COPY . .
RUN ./node_modules/.bin/prisma generate
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npx", "next", "start"]
