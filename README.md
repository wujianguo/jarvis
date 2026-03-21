# Jarvis（家庭事项管理 API）

Jarvis 是一个用于管理家庭事项的 **纯 API 后端服务**（NestJS + TypeScript）。项目以 **飞书 Bitable** 作为主要数据存储，提供统一的 REST API，逐步实现：

- 快递取件管理（到件记录、取件状态、查询统计）
- 短信接入（iOS 捷径自动化 → AI 分类 → 自动创建取件记录）
- 家庭财务（收支记录、分类、统计汇总）
- 其他家庭事项（待办/提醒/物品管理等）

> 本仓库当前已完成：基础 API 框架、Swagger、健康检查、飞书 OpenAPI（tenant token / Webhook 框架 / Bitable CRUD / Sheets 追加写入）以及 KV 缓存集成。业务域模块尚在建设中。

---

## 技术栈

- Node.js + TypeScript
- NestJS
- Swagger（OpenAPI）
- class-validator / class-transformer（请求校验/转换）
- Vercel AI SDK（`ai` + `ai-gateway-provider`，用于 SMS 分类）
- 飞书开放平台：
  - Bitable（作为主存储）
  - Sheets（可选：导出/日志）
- KV（可选：缓存 tenant_access_token 等，SMS 去重也使用 KV）

---

## 运行与访问

### 安装依赖

```bash
npm install
```

### 启动

```bash
# dev
npm run start:dev

# prod
npm run build
npm run start:prod
```

默认端口：`9000`

- Swagger：`http://localhost:9000/swagger`
- 健康检查：`http://localhost:9000/api/system/health`

---

## API 约定

- 全局前缀：`/api`
- Swagger 路径：`/swagger`
- 全局校验：
  - `transform: true`
  - `whitelist: true`
  - `forbidNonWhitelisted: true`

---

## 配置（.env / .env.local）

项目会按顺序加载：`.env.local` → `.env`

### 必要配置（启用飞书 Bitable 作为存储）

```bash
# 服务端口（可选，默认 9000）
PORT=9000

# 飞书应用（必填）
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=

# 飞书 Base URL（可选，默认 https://open.feishu.cn）
FEISHU_BASE_URL=https://open.feishu.cn

# 业务 Webhook 路径（可选，默认 /api/feishu/webhook）
FEISHU_WEBHOOK_PATH=/api/feishu/webhook

# Bitable "数据库名称 -> appToken + tables" 映射（建议必填）
# tables 字段映射逻辑表名到 Bitable tableId，列名在代码中写死。
# 示例：
# FEISHU_BITABLE_DATABASES_JSON={"home":{"appToken":"bascnxxxxxxxx","tables":{"express_pickups":{"tableId":"tblxxxxxxxx"},"express_assignees":{"tableId":"tblyyyyyyyy"}}}}
FEISHU_BITABLE_DATABASES_JSON={}
```

### 可选配置（KV：缓存 token 等）

```bash
KV_BASE_URL=
KV_API_TOKEN=
```

> 当前 `FeishuAuthService` 会把 tenant_access_token 缓存到 KV（减少频繁请求飞书）。SMS 去重功能也依赖 KV。

### 可选配置（Sheets：导出/日志）

```bash
FEISHU_SHEETS_EXPORT_SPREADSHEET_TOKEN=
FEISHU_SHEETS_EXPORT_SHEET_ID=
```

### SMS 接入配置（启用 `POST /api/sms/ingest`）

```bash
# Cloudflare 账号 ID（用于 AI Gateway）
CLOUDFLARE_ACCOUNT_ID=

# AI Gateway 名称
GATEWAY_NAME=

# Cloudflare AI Gateway Token
CF_AIG_TOKEN=

# 短信幂等去重 TTL（秒），默认 120 秒
SMS_DEDUP_TTL_SECONDS=120
```

> 当前实现通过 AI Gateway 路由 OpenAI 兼容模型，短信分类模型固定为 `gpt-5-mini`。

---

## 数据存储设计（Bitable）

Jarvis 的核心思路是：**每个业务域在 Bitable 中有一个 App（appToken），每个表（tableId）代表一种实体**。服务端只负责：

- 把外部请求转成对 Bitable 的 CRUD
- 维护必要的业务校验、字段映射、状态机
- 提供稳定的 API（屏蔽 Bitable API 细节）

> 目前代码已提供 `FeishuBitableService`（records 的 list/get/create/batchCreate/update/delete）与 `FeishuStorageService`（对 Bitable 的更高层封装）。

---

## 已实现接口

### System

- `GET /api/system/health`：健康检查

### Express 快递取件管理

- `POST /api/express/pickups` — 创建取件记录（写入 Bitable + 创建飞书任务 + 回写 task_id）
- `GET /api/express/pickups` — 查询取件记录列表
- `GET /api/express/pickups/:id` — 查询单条取件记录
- `PATCH /api/express/pickups/:id` — 更新取件记录（同步更新飞书任务）

### SMS 短信接入

- `POST /api/sms/ingest` — 接受 iOS 捷径自动化发来的短信，异步 AI 分类，自动创建取件记录

  **请求体：**
  ```json
  {
    "content": "【菜鸟驿站】您的包裹已到达，取件码：12345，地址：A栋一楼",
    "sender": "+86138xxxx",   // 可选，预留字段
    "receivedAt": "2024-03-09T12:00:00.000+08:00",  // 可选
    "device": "iPhone"        // 可选
  }
  ```

  **返回（202 Accepted）：**
  ```json
  {
    "accepted": true,
    "deduped": false,
    "fingerprint": "abc123..."
  }
  ```

  **幂等去重：** 同一短信在 `SMS_DEDUP_TTL_SECONDS`（默认 120 秒）内重复请求返回 `deduped: true`，不触发重复处理。

  > ⚠️ **安全提示**：本接口当前无鉴权，请勿在未做访问控制的情况下公开暴露。

### Feishu Webhook

- `POST /api/feishu/webhook`
  - 支持 `url_verification` challenge
  - 支持 schema 2.0 事件接收并按 `event_type` 分发
  - 支持 `task.task.update_tenant_v1` 事件：任务完成时自动回写取件记录 `status=done`

---

## Roadmap（按"纯 API + Bitable 存储"落地）

### A. 家庭财务（Finance）—— 纯 API

建议 Bitable 表（示例）：

- 表：`finance_records`
  - `type`（`income | expense | transfer`）
  - `amount`
  - `category`
  - `account`
  - `member`
  - `occurred_at`
  - `remark`

建议 API（规划）：

- `POST /api/finance/records` 新增记录
- `GET /api/finance/records` 查询（时间范围/分类/成员/账户）
- `GET /api/finance/summary` 汇总统计（按月/按分类等）

---

## 开发建议（下一步落地最省力的方式）

1. 为每个业务域建立独立 module：
   - `src/domains/express/*`
   - `src/domains/finance/*`

2. 在配置里补充"表 ID"层级（建议新增环境变量）：
   - 目前已经有 `FEISHU_BITABLE_DATABASES_JSON`（db name -> appToken）
   - 还需要补充每个实体对应的 `tableId`（例如 `EXPRESS_PACKAGES_TABLE_ID`）

3. 做一层字段映射（DTO <-> Bitable fields）：
   - DTO 用稳定字段名（例如 `pickupCode`）
   - Bitable fields 可保持中文列名也行，但建议统一映射，避免列名调整导致 API 破坏

---

## License

当前 `package.json` 为 `UNLICENSED`。如计划开源，请补充 LICENSE 并调整说明。

