FROM node:22-alpine AS base
WORKDIR /app

# 国内镜像加速（如用国外源可删下一行）
RUN npm config set registry https://registry.npmmirror.com

# 先装依赖，利用 docker layer 缓存
COPY package.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --ignore-scripts && \
    npm cache clean --force

# 复制源码
COPY . .

# Prisma 国内镜像加速
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
RUN ./node_modules/.bin/prisma generate
RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
