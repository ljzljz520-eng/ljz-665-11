package org.jeecg.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * @Description: 数据库连接启动自检。
 * 应用启动后立刻对主数据源执行 SELECT 1：
 * 1. 成功：在日志中打印醒目的连接成功横幅（地址/库名/数据库版本），用于确认连接配置生效；
 * 2. 失败：打印包含排查指引的错误横幅，并默认中断启动（fail-fast），
 *    避免“后端假死、前端白屏”这类难以定位的现象。
 * 可通过配置关闭：jeecg.db-check.enabled=false；仅告警不中断：jeecg.db-check.fail-fast=false
 *
 * @author: jeecg
 * @date: 2026/09/26
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DatabaseConnectionChecker implements ApplicationRunner {

    private final DataSource dataSource;

    /** 是否启用启动自检，默认开启 */
    @Value("${jeecg.db-check.enabled:true}")
    private boolean enabled;

    /** 连接失败时是否中断启动，默认中断（避免故障只表现为前端白屏） */
    @Value("${jeecg.db-check.fail-fast:true}")
    private boolean failFast;

    public DatabaseConnectionChecker(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("[DB-CHECK] 数据库连接启动自检已关闭（jeecg.db-check.enabled=false）");
            return;
        }
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("SELECT 1")) {
            DatabaseMetaData metaData = connection.getMetaData();
            String url = metaData.getURL();
            String catalog = connection.getCatalog();
            String product = metaData.getDatabaseProductName() + " " + metaData.getDatabaseProductVersion();
            if (rs.next()) {
                log.info("\n==========================================================\n"
                        + " [DB-CHECK] 数据库连接成功！\n"
                        + "   连接地址: {}\n"
                        + "   当前数据库: {}\n"
                        + "   数据库版本: {}\n"
                        + "==========================================================",
                        url, catalog, product);
            }
        } catch (Exception e) {
            log.error("\n==========================================================\n"
                    + " [DB-CHECK] 数据库连接失败！应用无法正常提供服务。\n"
                    + "   失败原因: {}\n"
                    + "   请检查:\n"
                    + "     1. SQL Server 是否已启动并就绪（docker compose ps / docker logs jeecg-sqlserver）\n"
                    + "     2. 连接配置是否正确（application-*.yml 中 datasource 的地址/端口/账号/密码，\n"
                    + "        或环境变量 SQLSERVER_HOST / SQLSERVER_PORT / SQLSERVER_DATABASE / SQLSERVER_USERNAME / SQLSERVER_PASSWORD）\n"
                    + "     3. 目标数据库是否已初始化（docker logs jeecg-sqlserver-init）\n"
                    + "==========================================================",
                    e.getMessage());
            if (failFast) {
                throw new IllegalStateException("[DB-CHECK] 数据库连接失败，应用启动中止。"
                        + "如仅需告警可设置 jeecg.db-check.fail-fast=false", e);
            }
        }
    }
}
