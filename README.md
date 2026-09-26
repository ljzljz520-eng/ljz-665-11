# JeecgBoot（SQL Server 版 Docker 一键启动）

本仓库在原 JeecgBoot 的基础上，提供了面向 SQL Server 的 Docker Compose 一键启动能力：通过 `db-init` 容器将 `backend/db/jeecgboot-mysql-5.7.sql` 转换为 SQL Server 可执行脚本并初始化数据库，然后启动后端与前端。

## 快速开始

### 1) 前置条件

- 已安装 Docker Desktop（含 Compose）
- 本机端口未被占用：`3665`（前端）、`8665`（后端）、`1433`（SQL Server）

### 2) 启动

在项目根目录 `jeecg-boot/` 执行：

```bash
docker compose up -d
```

如需自定义 SQL Server `sa` 密码（默认 `Supcon1304`），可通过环境变量覆盖：

```bash
MSSQL_SA_PASSWORD='YourStrongPassword!' docker compose up -d
```

### 3) 访问

- 前端：`http://localhost:3665`
- 后端：`http://localhost:8665`

默认账号密码（来源于官方后端说明）：`admin/123456`。

### 4) 停止与清理

```bash
docker compose down
```

如需清理 SQL Server 持久化数据（会删除数据库数据）：

```bash
docker compose down -v
```

## 文档

项目中文架构、设计、开发、测试与用户手册见 [docs/README.md](docs/README.md)。

