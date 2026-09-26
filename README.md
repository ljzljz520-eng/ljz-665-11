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

## 数据库连接配置

开发环境统一连接 SQL Server 的 **`temp1218`** 库，连接参数（端口、账号、密码）集中在后端配置文件中：

| 配置项 | 默认值 | 环境变量覆盖 |
| --- | --- | --- |
| 主机 | `127.0.0.1`（Compose 中为 `db`） | `SQLSERVER_HOST` |
| 端口 | `1433` | `SQLSERVER_PORT` |
| 数据库 | `temp1218` | `SQLSERVER_DB` |
| 账号 | `sa` | `SQLSERVER_USER` |
| 密码 | `Supcon1304` | `SQLSERVER_PASSWORD` |
| 完整连接串 | 由上列项拼接 | `SQLSERVER_JDBC_URL`（整体覆盖） |

配置文件位置（按启动方式生效其一）：

- `backend/jeecg-module-system/jeecg-system-start/src/main/resources/application-sqlserver.yml`
  —— Docker Compose 开发环境（`SPRING_PROFILES_ACTIVE=sqlserver`），Compose 通过 `SQLSERVER_*` 环境变量注入容器内主机名与密码；
- `backend/jeecg-module-system/jeecg-system-start/src/main/resources/application-dev.yml`
  —— 本地 IDE / Maven 默认 profile（`dev`），同样指向本机 `1433` 的 `temp1218`。

> 密码默认值仅用于开发环境，生产部署请通过 `SQLSERVER_PASSWORD` / `SQLSERVER_JDBC_URL` 环境变量覆盖，不要提交真实口令。

## 验证数据库连接

启动后按以下顺序验证，任何一步失败请先看「连接失败排查」：

1. **容器状态**：`db`、`db-init`（运行完成退出码 0）、`redis`、`backend`、`frontend` 全部就绪

   ```bash
   docker compose ps
   ```

2. **数据库初始化完成**（看到 `Database initialization finished.`）：

   ```bash
   docker compose logs db-init
   ```

3. **后端健康检查接口**（匿名可访问，会实际执行 `SELECT 1` 探测数据库）：

   ```bash
   curl http://localhost:8665/jeecg-boot/sys/health
   ```

   连接成功时返回 HTTP 200：

   ```json
   {"status":"UP","database":{"status":"UP","database":"temp1218","latencyMs":3}}
   ```

   数据库异常时返回 HTTP 503，`database.message` 中带有失败原因。

4. **（可选）直连 SQL Server 验证**：

   ```bash
   docker exec -it jeecg-sqlserver /opt/mssql-tools18/bin/sqlcmd \
     -S localhost -U sa -P 'Supcon1304' -C \
     -Q "SELECT DB_NAME(database_id) FROM sys.databases WHERE name='temp1218'"
   ```

5. **前端页面**：打开 `http://localhost:3665` 能看到登录页（默认 `admin/123456`）。

## 连接失败排查

后端或数据库连接失败时，前端**不会只显示白屏/无限加载**，而是展示明确的错误页（含失败原因与排查指引，可点击"重新检测"）。进一步定位：

- 后端日志：`docker compose logs -f backend`（数据库连接异常会在启动后首次访问数据库时报出）
- 健康检查：`curl -i http://localhost:8665/jeecg-boot/sys/health`，503 即数据库未连通
- 常见原因：
  - `db` 容器未就绪时后端已启动 → 稍等片刻，在前端错误页点击"重新检测"；
  - `MSSQL_SA_PASSWORD` 与已初始化的数据卷中密码不一致 → `docker compose down -v` 清理后重建；
  - 本机 `1433` 端口被其他 SQL Server 实例占用 → 修改 `docker-compose.yml` 端口映射并同步 `SQLSERVER_PORT`。

## 文档

项目中文架构、设计、开发、测试与用户手册见 [docs/README.md](docs/README.md)。

