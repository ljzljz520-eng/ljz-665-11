package org.jeecg.modules.system.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 平台健康检查接口（匿名可访问，无需登录）
 *
 * 用途：
 * 1. 前端启动时探测后端与数据库可用性，连接失败时给出明确提示，而不是白屏；
 * 2. 部署后验证 SQL Server 连接配置（temp1218）是否生效。
 *
 * 返回示例（正常）：{"status":"UP","database":{"status":"UP","database":"temp1218","latencyMs":3}}
 * 数据库异常时 HTTP 状态码为 503，并带有明确的错误信息。
 */
@Slf4j
@RestController
@RequestMapping("/sys/health")
public class SysHealthController {

    @Autowired
    private DataSource dataSource;

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        Map<String, Object> db = checkDatabase();
        boolean dbUp = "UP".equals(db.get("status"));

        body.put("status", dbUp ? "UP" : "DOWN");
        body.put("database", db);

        HttpStatus httpStatus = dbUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
        if (!dbUp) {
            log.error("[JEECG] 健康检查失败：数据库不可用 -> {}", db.get("message"));
        }
        return new ResponseEntity<>(body, httpStatus);
    }

    /**
     * 执行 SELECT 1 探测数据库连通性
     */
    private Map<String, Object> checkDatabase() {
        Map<String, Object> db = new LinkedHashMap<>();
        long start = System.currentTimeMillis();
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT 1")) {
            rs.next();
            db.put("status", "UP");
            db.put("database", conn.getCatalog());
            db.put("latencyMs", System.currentTimeMillis() - start);
        } catch (Exception e) {
            db.put("status", "DOWN");
            // 只返回异常摘要，避免泄露连接串、账号等敏感信息
            String msg = e.getMessage();
            if (msg != null && msg.length() > 200) {
                msg = msg.substring(0, 200);
            }
            db.put("message", msg);
            db.put("exception", e.getClass().getSimpleName());
        }
        return db;
    }
}
