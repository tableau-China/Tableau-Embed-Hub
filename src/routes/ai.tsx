import { createFileRoute } from '@tanstack/react-router'

import { AiChatPage } from '@/features/ai/ai-chat-page'

/**
 * `/ai` —— AI 对话页（跨团队页面，无 slug）。
 *
 * 权限与导航都不在这个文件里：见 `src/config/permissions.ts` 的 `ROUTE_CATALOG`（`page.ai` 一行），
 * 侧边栏入口与 URL 直达拦截由同一条目录驱动。
 */
export const Route = createFileRoute('/ai')({
  component: AiChatPage,
})
