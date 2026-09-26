/**
 * 后端/数据库启动健康检查
 *
 * 前端应用挂载前先探测后端 `/sys/health`：
 *  - 后端不可达（服务未启动、nginx 502、网络中断）→ 展示明确错误页；
 *  - 后端可达但数据库连接失败（如 SQL Server 配置错误）→ 展示数据库故障提示；
 * 避免连接失败时页面只剩 loading 动画或白屏，用户无法感知原因。
 */

export interface BackendHealthResult {
  /** 是否可用（后端存活且数据库连接正常） */
  ok: boolean;
  /** 失败阶段：backend=后端不可达；database=数据库连接失败 */
  stage: 'backend' | 'database' | null;
  /** 展示给用户的失败说明 */
  message: string;
  /** 实际探测成功的地址（失败时为最后尝试的地址） */
  url?: string;
}

/** 单次探测结论：ok=健康；db-down=后端可达但数据库异常；unreachable=网络/网关不可达；invalid=该候选地址并非后端 API（如命中前端页面） */
type ProbeKind = 'ok' | 'db-down' | 'unreachable' | 'invalid';

interface ProbeResult {
  kind: ProbeKind;
  base: string;
  message?: string;
}

const HEALTH_PATH = '/sys/health';
const TIMEOUT_MS = 5000;

/**
 * 候选后端地址（按优先级）：
 * 1. VITE_GLOB_DOMAIN_URL（dev 模式读取 .env，docker 构建时内联为 /jeecgboot）
 * 2. window._CONFIG.domianURL（运行时全局配置，docker 部署时由 _app.config.js 注入）
 * 3. /jeecgboot —— docker-compose 部署下 nginx 对后端的代理路径
 * 4. /jeecg-boot —— 后端 context-path 直连/自定义反代场景
 */
function getCandidateBaseUrls(): string[] {
  const urls: string[] = [];
  const envDomain = import.meta.env.VITE_GLOB_DOMAIN_URL;
  if (typeof envDomain === 'string' && envDomain.length > 0) {
    urls.push(envDomain.replace(/\/+$/, ''));
  }
  const conf = (window as any)._CONFIG || {};
  if (typeof conf.domianURL === 'string' && conf.domianURL.length > 0) {
    urls.push(conf.domianURL.replace(/\/+$/, ''));
  }
  urls.push('/jeecgboot');
  urls.push('/jeecg-boot');
  return [...new Set(urls)];
}

async function probe(base: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`${base}${HEALTH_PATH}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    // 网络错误、超时、跨域被拒绝
    return { kind: 'unreachable', base };
  } finally {
    clearTimeout(timer);
  }

  const contentType = resp.headers.get('content-type') || '';
  // 非 JSON 响应：命中了前端页面（history 路由回退到 index.html）或网关默认错误页，该候选无效
  if (!contentType.includes('application/json')) {
    return { kind: resp.status >= 502 && resp.status <= 504 ? 'unreachable' : 'invalid', base };
  }
  const data = await resp.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    return { kind: 'invalid', base };
  }
  if (resp.ok && data.status === 'UP') {
    return { kind: 'ok', base };
  }
  if (resp.status === 502 || resp.status === 504) {
    return { kind: 'unreachable', base };
  }
  // 后端返回了结构化健康信息但状态异常（典型场景：后端活着、数据库连不上）
  const dbMsg: string | undefined = data?.database?.message;
  return {
    kind: 'db-down',
    base,
    message: dbMsg ? `数据库连接失败：${dbMsg}` : `后端健康检查未通过（HTTP ${resp.status}）`,
  };
}

/**
 * 并发探测所有候选地址：
 *  - 任一地址返回正常 → 整体可用；
 *  - 否则只要有一个地址拿到了后端的健康响应（后端活着但 DB 异常）→ 报数据库故障；
 *  - 其余情况 → 后端不可达。
 */
export async function checkBackendHealth(): Promise<BackendHealthResult> {
  const candidates = getCandidateBaseUrls();
  const results = await Promise.all(candidates.map((base) => probe(base)));

  const ok = results.find((r) => r.kind === 'ok');
  if (ok) {
    return { ok: true, stage: null, message: '', url: ok.base };
  }
  const dbDown = results.find((r) => r.kind === 'db-down');
  if (dbDown) {
    return { ok: false, stage: 'database', message: dbDown.message || '数据库连接失败', url: dbDown.base };
  }
  return {
    ok: false,
    stage: 'backend',
    message: `无法连接后端服务（已尝试：${candidates.join('、')}）`,
    url: candidates[0],
  };
}

/**
 * 将 #app 中的 loading 动画替换为明确的错误提示页（纯 DOM 实现，不依赖 Vue 挂载）
 */
export function renderBackendDownPage(result: BackendHealthResult): void {
  const container = document.getElementById('app');
  if (!container) {
    return;
  }
  const isDb = result.stage === 'database';
  const title = isDb ? '数据库连接失败' : '后端服务连接失败';
  const tips = isDb
    ? [
        '确认 SQL Server 容器已启动：docker compose ps',
        '核对后端连接配置：backend/.../application-sqlserver.yml（temp1218 / 1433 / sa）',
        '查看后端日志定位原因：docker compose logs backend',
      ]
    : [
        '确认后端容器已启动：docker compose ps',
        '查看后端启动日志：docker compose logs -f backend',
        '数据库初始化中时后端可能短暂不可用，可稍后点击“重新检测”',
      ];

  container.innerHTML = `
    <div style="display:flex;width:100%;height:100%;min-height:100vh;justify-content:center;align-items:center;background:#f4f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
      <div style="max-width:560px;padding:40px 48px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center;">
        <div style="font-size:48px;line-height:1;margin-bottom:16px;">⚠️</div>
        <h2 style="margin:0 0 12px;font-size:20px;color:rgba(0,0,0,.85);">${title}</h2>
        <p style="margin:0 0 20px;font-size:14px;color:rgba(0,0,0,.55);word-break:break-all;">${escapeHtml(result.message)}</p>
        <ol style="margin:0 0 24px;padding-left:20px;text-align:left;font-size:13px;color:rgba(0,0,0,.65);line-height:1.9;">
          ${tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
        </ol>
        <button id="backend-health-retry" style="padding:8px 28px;font-size:14px;color:#fff;background:#0065cc;border:none;border-radius:4px;cursor:pointer;">重新检测</button>
        <p style="margin:16px 0 0;font-size:12px;color:rgba(0,0,0,.35);">详细排查步骤见项目 README「验证数据库连接」一节</p>
      </div>
    </div>`;
  document.getElementById('backend-health-retry')?.addEventListener('click', () => {
    window.location.reload();
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
