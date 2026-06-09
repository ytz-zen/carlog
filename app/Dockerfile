FROM node:22-slim AS base
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

# Prisma 引擎（npm install 时已通过 npmmirror 下载）
RUN ./node_modules/.bin/prisma generate
RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
