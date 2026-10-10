# ScholarFlow 接入真实 AI 与 NK-GeniOS Agent

本文件说明如何把本地 ScholarFlow 从“确定性规则演示”切换为真实 AI，并把南开 GeniOS 智能体作为顶层编排入口。

## 一、架构

```
浏览器 / 本地工作台 ──► 本地 FastAPI（科研状态 + 13 个 HTTP 工具）
                              │
                              ├─(A) OpenAI 兼容模型
                              ├─(B) NK-GeniOS (Coze) /v3/chat
                              └─(C) 本地浏览器桥接（CDP，复用已登录窗口）

上述三条均为本机出站：由本机主动调用平台或模型服务，平台不需要访问本机。
13 个工具接口仅供本机或受控内网调用，不暴露到公网。
```

- 网站在项目内的 AI 功能（研究规划、研究空白、证据抽取、论文问答、研究设计、写作草稿）由后端 `AI_PROVIDER` 决定用哪个模型。
- 13 个工具接口（`/api/genios/*`）用于本机或受控内网读写项目状态；平台智能体反向编排本地工具的能力当前不启用，详见第三节。
- 任何凭据都不填写时，接口自动回退到确定性规则（`demo_mode`），功能仍可用。

## 二、第一步：让网站本身用上模型（三种方式任选其一）

### 方案 A：OpenAI 兼容接口（最快）

在项目根目录 `.env` 中填写：

```
AI_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1   # 或 DeepSeek / 本地 vLLM 等兼容地址
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4.1-mini
```

重启后端后，打开 Settings 页应显示“已连接”。

### 方案 B：NK-GeniOS 智能体（Coze OpenAPI）

智能体已经存在，不需要新建（记录见 [deployment-status.md](deployment-status.md)）：

- 空间：ScholarFlow `db3qjd5r805t2j8eb9ag`
- 智能体：ScholarFlow 科研助手 `db3qtdd4shhas0al22qg`

需要做的平台操作：

1. 用南开统一身份认证登录 <https://coze.nankai.edu.cn>。
2. 进入该空间 → 应用「ScholarFlow 科研助手」→ 打开右侧/顶部的「发布」面板。
3. 在渠道列表确认 **API** 已启用且状态为“运行中”（MCP / WebSDK 仍为已停用，本项目当前不使用）。
4. 生成**个人访问令牌（PAT）**：点击头像 → 个人设置 → 「访问令牌 / 个人访问令牌」→ 新建令牌，勾选该空间/该智能体的权限，生成后立即复制（只显示一次）。
5. 在 API 渠道页面确认两件事：
   - 该智能体的 **Bot ID**（即 `db3qtdd4shhas0al22qg`，如平台显示成别的值以平台为准）；
   - **API 基地址**。公开扣子是 `https://api.coze.cn`；南开为私有化部署，基地址必须以平台页面给出的为准，不能照抄公网地址。
6. 写回 `.env`（API 渠道显示“运行中”时的基地址与 APPID）：

```
AI_PROVIDER=coze
GENIOS_BASE_URL=https://coze.nankai.edu.cn/api/proxy/api/v1
GENIOS_API_KEY=<上一步的 PAT>
GENIOS_AGENT_ID=db3qtdd4shhas0al22qg
GENIOS_CHAT_PATH=/v3/chat
```

   注意页面上标的是 **APPID**，值与智能体 ID 相同（`db3qtdd4shhas0al22qg`），它就是调用时用的 bot/agent 标识。

7. 由于南开是私有化部署，实际聊天路径不一定是公开扣子的 `/v3/chat`。点开页面上的「接口说明」，或直接跑探测脚本确认：

```powershell
.venv\Scripts\python.exe backend\scripts\check_genios.py
```

脚本会用 `.env` 里的凭据依次尝试 `GENIOS_CHAT_PATH`、`/chat/completions`、`/chat`、`/open_api/v2/chat` 四种形态，打印每个地址的状态码与响应片段（不会打印密钥）。哪个返回 2xx，就把 `GENIOS_CHAT_PATH` 改成对应路径。

8. 重启后端（`.\start.ps1`），打开 Settings 页确认 AI 服务商显示 `coze` 且状态为“已连接”。

后端调用的是 Coze OpenAPI：`POST {GENIOS_BASE_URL}/v3/chat`（阻塞模式）→ 轮询 `/v3/chat/retrieve` → 取 `/v3/chat/message/list` 里的 `answer`。实现见 `backend/app/llm.py`。

### 方案 C：本地浏览器桥接（`AI_PROVIDER=genios_browser`）

适用于"平台接口受统一认证保护、拿不到可外部调用的 API"的情况。后端不保存任何校园凭据，而是复用**一个已登录的本地浏览器窗口**（通过 CDP 调试端口）驱动已发布的聊天页面，把回答取回来。

**为什么需要它**：实测本章程的 `/api/proxy/api/v1` 走不通——外部请求（无论带 API 密钥、`?api_key=` 还是自定义头）都会被网关 302 到 `iam.nankai.edu.cn`；在已登录页面里访问该前缀则一律 404。也就是说该部署的网关在放行前先做统一认证，服务端直连不可行。

**启动一个有调试端口的独立浏览器**（独立 profile，不影响日常浏览器会话）：

```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --remote-debugging-port=9222 `
  --user-data-dir='C:\Users\<你>\.codex\edge-genios' `
  --no-first-run --no-default-browser-check --new-window `
  'https://coze.nankai.edu.cn/'
```

在该窗口完成南开统一身份认证（**不要把账号、Cookie 或验证码提供给他人或写入文件**），然后配置 `.env`：

```
AI_PROVIDER=genios_browser
BROWSER_CDP_URL=http://127.0.0.1:9222
BROWSER_TARGET_HOST=coze.nankai.edu.cn
BROWSER_CHAT_URL=https://coze.nankai.edu.cn/product/llm/chat/db42qo54shhbpg8vnl40
BROWSER_TIMEOUT_SECONDS=240
BROWSER_NEW_CONVERSATION=true
```

重启后端后，`/api/health` 的 `browser_bridge` 会显示 `logged_in: true`，Settings 页也会显示"浏览器桥接：已登录"。此时研究规划 / 证据抽取 / 研究设计 / 写作草稿 / 论文问答 会真正走智能体，返回体的 `mode` 变成 `ai:genios_browser`。

**限制与注意事项**：

- 会话会过期（本部署历史上多次失效）。过期后桥接自动返回 `None`，后端回退到确定性规则并继续可用；重新在同一个浏览器窗口登录即可恢复。
- 每次调用默认新开一个会话（`BROWSER_NEW_CONVERSATION=true`），避免上下文串味；设为 `false` 可复用当前会话。
- 依赖页面 DOM（输入框 `[contenteditable="true"]`、发送按钮 `[class*="send-button"]`、回答 `[class*="messageAIWrapper"] .paragraph-element`）。平台前端改版后需要同步更新 `backend/app/browser_bridge.py` 里的选择器。
- **调试端口只应绑定 127.0.0.1**，演示结束请关闭该浏览器窗口——开着它等于把已登录会话暴露给本机所有进程。
- 单次调用约 10–20 秒（含模型生成），比直连模型慢，适合演示与人工使用，不适合高并发。

## 三、集成方向说明

本项目采用**本机出站**的集成方向：由本机后端主动调用平台或模型服务（方案 A / B / C），平台不需要访问本机地址。该方向已实测可用。

`genios/tools.json` 中的 13 个工具接口保留并可用，供本机或受控内网环境调用，不对外暴露。

### 关于工具令牌

`GENIOS_TOOL_TOKEN` 为可选的访问令牌：设置后 `/api/genios/*` 要求请求头 `Authorization: Bearer <GENIOS_TOOL_TOKEN>`；未设置时端点保持开放，仅适合本机使用。

### 工具注册（备查）

下列信息仅在将来改用内网部署或反向连接时才会用到，当前不启用：

- `genios/tools.json` 定义了 13 个工具（`project_create`、`research_plan`、`literature_search`、`evidence_extract`、`gap_analyze`、`research_design`、`data_analyze`、`writing_draft` 等）。
- Coze 插件需要 OpenAPI 3 schema；`tools.json` 为 JSON Schema 形式，导入前需将 `$defs` / `$ref` 展开并转换。
- 智能体提示词中需说明：项目状态通过上述工具读写，工具失败应如实说明，不得编造项目 ID。

## 四、验证清单

| 检查项 | 期望结果 |
| --- | --- |
| `GET /api/health` | `ai_provider` 为 `coze`/`openai`/`genios_browser`，`ai_configured=true`；浏览器桥接模式下 `browser_bridge.logged_in=true`；设置了工具令牌时 `tool_auth_required=true` |
| Settings 页 | 「AI 服务商」「NK-GENIOS 智能体」两张卡片显示已连接与智能体 ID |
| 研究规划 / 证据抽取 / 写作草稿 | 返回体 `mode` 由 `deterministic-fallback` 变为 `ai:coze` / `ai:openai` / `ai:genios_browser` |
| 未授权调用 | 设置令牌后，不带 `Authorization` 调用 `/api/genios/project/status` 返回 401 |
| 平台侧 | 调用 `/api/genios/project/create` 返回 `{"ok": true, "data": {...}, "tool": "project_create"}` |

## 五、安全边界

- 不要把 PAT、统一身份认证 Cookie、密码写进仓库或聊天；`.env` 已被 `.gitignore` 排除。
- 后端仅供本机或受控内网使用，鉴权仅覆盖 `/api/genios/*`；`GENIOS_TOOL_TOKEN` 为可选访问令牌。
- 平台侧 API 渠道已启用（运行中）；MCP / WebSDK 仍为已停用。由于网关对 `/api/*` 强制统一认证，服务端直连不可行，需要走方案 C 的浏览器桥接。
- 智能体仍可能受 arXiv 等外部服务限流（HTTP 429）影响，工具失败时应如实返回错误而不是编造结果。

## 六、当前进度

- 已完成（代码）：AI Provider 抽象（OpenAI 兼容 + Coze + 本地浏览器桥接）、把研究规划/研究空白/证据抽取/论文问答/研究设计/写作草稿改为 AI 优先并保留规则回退、工具接口令牌鉴权、`/api/health` 与 Settings 的状态展示、`.env` 模板。
- 已完成（验证）：方案 C 浏览器桥接实测通过——`AI_PROVIDER=genios_browser` 时研究规划返回智能体真实生成的问题（针对 PCFG 口令猜测主题），`mode: ai:genios_browser`。
- 已知限制：方案 B（用 API 密钥服务端直连）在当前部署不可行，`/api/*` 被统一认证网关拦截，因此实际使用方案 C。平台智能体反向调用本地工具的能力当前不启用；`genios/tools.json` 的工具接口仅供本机或受控内网调用。
