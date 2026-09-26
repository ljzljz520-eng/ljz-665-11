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

## SQL Server 连接配置

开发环境统一连接 SQL Server 的 **`temp1218`** 库，端口、账号、密码均集中在配置文件中，可用环境变量覆盖：

| 配置项 | 默认值 | 环境变量 |
| --- | --- | --- |
| 主机 | `127.0.0.1`（docker 编排中为 `db`） | `SQLSERVER_HOST` |
| 端口 | `1433` | `SQLSERVER_PORT` |
| 数据库 | `temp1218` | `SQLSERVER_DATABASE` |
| 账号 | `sa` | `SQLSERVER_USERNAME` |
| 密码 | `Supcon1304` | `SQLSERVER_PASSWORD` |

配置位置：

- **本地开发**（默认 `dev` profile）：[backend/jeecg-module-system/jeecg-system-start/src/main/resources/application-dev.yml](backend/jeecg-module-system/jeecg-system-start/src/main/resources/application-dev.yml) 的 `spring.datasource.dynamic.datasource.master`
- **Docker 部署**（`sqlserver` profile）：[application-sqlserver.yml](backend/jeecg-module-system/jeecg-system-start/src/main/resources/application-sqlserver.yml)，连接参数由 [docker-compose.yml](docker-compose.yml) 中 `backend.environment` 注入；`sa` 密码通过根目录环境变量 `MSSQL_SA_PASSWORD` 统一修改（`db`、`db-init`、`backend` 三处联动）

### 如何验证连接成功

1. **看后端启动日志**（最直接）：启动自检通过会打印横幅

   ```bash
   docker logs jeecg-backend --tail 50
   ```

   出现如下内容即连接成功：

   ```
   [DB-CHECK] 数据库连接成功！
      连接地址: jdbc:sqlserver://db:1433;...DatabaseName=temp1218...
      当前数据库: temp1218
   ```

2. **查健康检查接口**：

   ```bash
   curl http://localhost:8665/jeecg-boot/actuator/health
   ```

   返回 `{"status":"UP", ...}` 且 `components.db.status` 为 `UP` 即正常。

3. **直连数据库抽查**：

   ```bash
   docker exec jeecg-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
     -P "${MSSQL_SA_PASSWORD:-Supcon1304}" -C -d temp1218 \
     -Q "SELECT COUNT(1) AS user_count FROM sys_user;"
   ```

### 连接失败时不再是“白屏”

- **后端**：启动自检失败会在日志打印 `[DB-CHECK] 数据库连接失败！` 横幅（含排查指引）并以非零码退出，`docker compose ps` 可见 `jeecg-backend` 为 `Exited`；健康检查接口会显示 `DOWN`。
- **前端**：页面超过 20 秒停留在加载页时，会自动检测后端健康状态并显示错误原因与排查建议，而不是无提示白屏。
- 如仅需告警不中断启动，可设置 `JEECG_DBCHECK_FAILFAST=false`（对应配置 `jeecg.db-check.fail-fast`）；关闭自检用 `JEECG_DBCHECK_ENABLED=false`。

## 文档

项目中文架构、设计、开发、测试与用户手册见 [docs/README.md](docs/README.md)。

