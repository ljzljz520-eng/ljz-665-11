# Walkthrough（交付回放）

## 目标

在全新环境中，使用 SQL Server 作为数据库，通过 Docker Compose 一键启动 JeecgBoot，并确保数据库初始化成功、前后端可访问。

## 回放步骤

### 1) 启动全量服务

在 `jeecg-boot/` 目录执行：

```bash
docker compose up -d
```

### 2) 等待初始化完成

```bash
docker logs jeecg-sqlserver-init --tail 200
```

预期日志包含：`Database initialization finished.`，且容器最终状态为 `Exited (0)`。

### 3) 访问前后端

- 打开 `http://localhost:3665`，确认登录页可见
- 登录账号：`admin`，密码：`123456`

### 4) 数据库校验

```bash
docker exec jeecg-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD:-Supcon1304}" -C -d temp1218 \
  -Q "SELECT COUNT(1) AS user_count FROM sys_user;"
```

预期返回 `user_count > 0`。

## 常见故障与处理

### 初始化失败

处理步骤：

1. 查看 `jeecg-sqlserver-init` 日志定位报错信息。
2. 重建数据库并重跑初始化：

```bash
docker exec jeecg-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD:-Supcon1304}" -C \
  -Q "IF DB_ID(N'temp1218') IS NOT NULL BEGIN ALTER DATABASE [temp1218] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [temp1218]; END; CREATE DATABASE [temp1218];"

docker compose up -d --force-recreate db-init
```

### 端口冲突

检查是否已有进程占用 `3665/8665/1433`，或在 `docker-compose.yml` 中修改映射端口。

