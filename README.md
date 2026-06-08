# 车行记 (CarLog)

汽车行驶轨迹记录系统 — 服务端 + Android 客户端

## 项目结构

```
├── app/                    # 后端 + Web 仪表盘（Next.js + Prisma + PostgreSQL）
│   ├── prisma/schema.prisma
│   ├── src/app/api/        # REST API
│   ├── src/components/     # React 前端组件
│   └── Dockerfile
├── carlog-android/         # Android 客户端（Kotlin + Room + OkHttp）
│   └── app/src/main/java/com/carlog/
├── docker-compose.yml      # Docker 部署
└── .github/workflows/      # GitHub Actions 自动构建 APK
```

## 快速部署（服务端）

在 NAS 上执行：

```bash
cd /app/carlog
docker compose up -d --build
```

访问 `http://NAS_IP:3000`

## Android APK 构建

每次 push 到 main 分支，GitHub Actions 自动构建 APK。

在仓库的 **Actions** 页面下载最新的 `carlog-apk` 产物。

## 默认配置

| 配置项 | 默认值 |
|--------|--------|
| API Key | `carlog_dev_key_2026` |
| 服务器端口 | 3000 |
| 数据库密码 | `carlog_secure_2026` |
| Android 默认服务器 | `http://192.168.5.193:3000` |
