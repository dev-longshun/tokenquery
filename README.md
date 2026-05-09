# tokenquery

独立的令牌查询系统，与 NewAPI 完全解耦。面向第三方客户，让他们不登录 NewAPI 后台就能用令牌 `sk-xxx` 查询额度与使用日志。

## 架构

```
[客户浏览器]
    │ HTTPS
    ▼
  query-hk.example.com  ─┐
  query-usa.example.com ─┼──► [tokenquery 容器] ──HTTPS──► [NewAPI 站点 A/B/C...]
  query-admin.example.com┘     (SQLite 存站点配置)
```

- **按 Host 路由**：每个客户子域名在数据库里绑定到某个 NewAPI 站点的 `base_url`。
- **不需要改 NewAPI**：只调用 NewAPI 已有的公开接口 `/api/usage/token/` 和 `/api/log/token`。
- **分页/筛选/CSV 导出**：在本服务端完成（因为 NewAPI 的 `/api/log/token` 目前最多返回最近 1000 条）。

## 环境变量

- `TOKENQUERY_JWT_SECRET`（必填）：管理员 JWT 签名密钥。
- `TOKENQUERY_ADMIN_USER` / `TOKENQUERY_ADMIN_PASS`（首次启动）：首次初始化的管理员账号。已存在管理员则忽略。
- `TOKENQUERY_LISTEN`（默认 `:8080`）
- `TOKENQUERY_DATA_DIR`（默认 `./data`）

## 本地开发

```
cd web && bun install && bun run build && cd ..
TOKENQUERY_JWT_SECRET=dev TOKENQUERY_ADMIN_USER=admin TOKENQUERY_ADMIN_PASS=demo \
  go run ./cmd/server
```

然后访问 http://127.0.0.1:8080/admin 登录 → 新增站点 → 访问查询页。

前端热更新：另开一个 tab `cd web && bun run dev`，dev 端口 5174，API 会代理到后端 18080（见 vite.config.js）。

## 生产部署

构建镜像（在本项目根目录）：

```
docker build -t tokenquery:local .
```

或用 compose（`.env` 里填敏感变量）：

```
TOKENQUERY_JWT_SECRET=...
TOKENQUERY_ADMIN_USER=admin
TOKENQUERY_ADMIN_PASS=...
```

```
docker compose up -d
```

Nginx 多个子域名都反代到这个容器（示例）：

```nginx
server {
    listen 443 ssl http2;
    server_name query-hk.example.com query-usa.example.com query-admin.example.com;

    ssl_certificate     /etc/letsencrypt/live/query.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/query.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

管理员后台只要在 `query-admin.example.com` 访问 `/admin` 即可登录，登录不区分来源域名。
