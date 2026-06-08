FROM node:22-alpine AS base
WORKDIR /app

# 国内镜像加速（如用国外源可删下一行）
RUN npm config set registry https://registry.npmmirror.com

# 先装依赖，利用 docker layer 缓存
COPY package.json ./
# 有 lockfile 用 ci（更快），否则用 install
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi && npm cache clean --force

# 复制源码
COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
