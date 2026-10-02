# 接入 AI 能力（代理契约 + 样例）

> 目标：让 `/ai` 页面从**内置演示 provider** 切到真实模型，同时**保证 API Key 永远只在服务端**。

## 铁律（先读这三条）

1. **API Key 绝不能进前端**。本模板是纯前端应用，`.env` 里的值**构建时内联进 JS bundle** —— 放 `VITE_*` 就等于公开（Tableau 那套能放，是因为 Connected App 本就为"浏览器内签发 JWT"设计；模型 Key 没有这个前提）。
2. **前端只认同源代理**（`VITE_AI_PROXY_URL`，默认留空 = 演示模式）。页面代码里没有任何一处读取厂商 Key，也不该有。
3. **代理必须说 OpenAI 兼容协议**：`POST {proxy}/chat/completions`，`stream: true`，返回 SSE。DeepSeek、OpenAI 以及绝大多数网关都原生符合；换厂商不用改前端。

## 数据流

```
浏览器 (/ai 页面)
   │  POST {VITE_AI_PROXY_URL}/chat/completions   ← 不带任何 Key
   ▼
你的同源代理（nginx / Node / Serverless）
   │  + Authorization: Bearer <厂商 Key>          ← Key 只在这里
   ▼
模型厂商（默认 https://api.deepseek.com）
   │  text/event-stream
   ▲  原样回传（注意关闭响应缓冲）
```

## 契约（前端只依赖这些）

**请求**（`src/lib/ai/deepseek.ts` 发出）

```http
POST {VITE_AI_PROXY_URL}/chat/completions
content-type: application/json

{ "model": "deepseek-chat", "messages": [{"role":"system","content":"…"},{"role":"user","content":"…"}], "stream": true }
```

**响应**

```
content-type: text/event-stream

data: {"choices":[{"delta":{"content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: [DONE]
```

前端会累积 `choices[0].delta.content`，收到 `[DONE]` 结束；`choices[0].message.content`（非流式）也能被兜住，所以代理不强制流式，但**强烈建议流式**（否则用户要盯着空屏等待）。

**错误**：非 2xx 时前端读一小段响应体并展示，便于把上游报错（模型名写错、额度用尽）透出来；`401/403` 会提示"重试无用"，`429/5xx` 允许重试。

## 三种落法（任选）

### ① nginx 反代（最省事）

见 `deploy/nginx.conf.example` 里注释掉的 `location /ai-proxy/` 段 —— 要点是 `proxy_buffering off;`，否则 SSE 会攒成一坨再吐给浏览器。适合"厂商 Key 放 nginx 变量/upstream 头"的场景。

### ② 自建 Node 网关（约 20 行，无依赖）

```js
// gateway.mjs —— node gateway.mjs  （DEEPSEEK_API_KEY=xxx）
import { createServer } from 'node:http'

const KEY = process.env.DEEPSEEK_API_KEY
if (!KEY) throw new Error('DEEPSEEK_API_KEY is required')

createServer(async (req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/chat/completions')) {
    res.writeHead(404).end('not found')
    return
  }
  const body = await new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => resolve(raw))
  })

  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body,
  })

  res.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
    'cache-control': 'no-cache',
  })
  for await (const chunk of upstream.body) res.write(chunk) // 逐块转发，别攒
  res.end()
}).listen(8787)
```

前端设 `VITE_AI_PROXY_URL=/ai-proxy`，再让开发代理或部署网关把 `/ai-proxy` 指到 `http://127.0.0.1:8787`。

### ③ Serverless / 边缘函数

任意平台同理：入参转成上游请求、Key 放环境变量、响应流原样回传。注意选支持流式响应的运行时。

## 环境变量

| 变量 | 说明 | 缺省 |
| --- | --- | --- |
| `VITE_AI_PROXY_URL` | 同源代理路径，如 `/ai-proxy`。**留空 = 内置演示 provider** | 空 |
| `VITE_AI_MODEL` | 透传给上游的模型名 | `deepseek-chat` |
| `VITE_AI_SYSTEM_PROMPT` | 系统提示词 | 模板内置的默认值 |

代理侧（**服务端**环境变量，不进前端）：`DEEPSEEK_API_KEY` 之类。

## 验收清单

- [ ] `/help` → Environment check 卡片的 **AI provider** 显示 `Via proxy` + 模型名；
- [ ] `/ai` 问答能流式出字（不是整段突然出现）；
- [ ] 生成中点 **Stop** 立即停住，且已生成内容保留；
- [ ] 拔掉代理再问 → 出现错误条并有 **Retry**（`401/403` 时提示重试无用）；
- [ ] 浏览器 Network 里**看不到任何厂商 Key**（只有对 `/ai-proxy` 的请求）。

## 排查表

| 现象 | 原因 |
| --- | --- |
| 页面一直显示 Demo provider | `.env` 里 `VITE_AI_PROXY_URL` 为空，或改了没重新构建 |
| 内容一次性全部出现 | 代理开了缓冲：nginx 加 `proxy_buffering off;`，或网关没按块 flush |
| `AI 代理返回 404` | 路径不对：前端会拼 `{proxy}/chat/completions`，代理要匹配这个完整路径 |
| `没有返回任何内容` | 代理返回的不是 OpenAI 兼容格式（前端只认 `choices[0].delta.content`） |
| `401 / 403` | Key 无效或额度用尽 —— 这类失败重试无用 |
| `429` / 5xx | 限流或上游故障 —— 可以 Retry |
| 请求被浏览器拦（CORS） | 代理没有配成**同源**（`VITE_AI_PROXY_URL` 必须是同源路径，如 `/ai-proxy`） |

## 进阶：把 AI 接到 Tableau 上

本模板的 `/ai` 目前是通用对话。要与 Tableau 结合，推荐 **VizQL Data Service**（VDS，`POST /api/v1/vizql-data-service/query-datasource`）：让模型把自然语言转成对某个数据源的查询，把结果渲染进现有页面。

要点：VDS 同样**不支持 CORS**，因此请求走已经存在的 REST 反代（`VITE_TABLEAU_API_BASE`）即可；而"自然语言 → 查询"这一跳建议放在同一个代理里（服务端拼提示词、校验生成的查询），既省一次往返，也避免把数据源元信息暴露给浏览器以外的第三方。
