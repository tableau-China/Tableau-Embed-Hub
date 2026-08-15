# shadcn-admin-cn

基于 shadcn/ui + Tailwind CSS v4 + Radix UI 从零构建的管理后台模板（当前仅英文，多语言后期扩展）。

> 当前状态：Phase 0（项目骨架）——脚手架、路由、i18n 框架（当前仅 en-US）、CI 已就绪。

## 技术栈

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | React | 19.x |
| 语言 | TypeScript | 7.1.0-dev（原生编译器，开发版验证，正式版发布后升级） |
| 构建 | Vite | 8.x |
| 样式 | Tailwind CSS v4 + shadcn/ui（new-york） | 4.x |
| 组件底层 | Radix UI | 最新 |
| 路由 | TanStack Router（文件路由） | 1.x |
| 数据请求 | TanStack Query | 5.x |
| 国际化 | i18next + react-i18next | 26.x（当前仅 en-US，后期扩展） |

## 快速开始

```bash
pnpm install
pnpm dev
```

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 类型检查（tsc -b）+ 生产构建 |
| `pnpm lint` | ESLint 检查 |
| `pnpm check:i18n` | 校验语言词典 key 对齐（当前仅 en-US） |
| `pnpm typecheck` | 仅类型检查 |

## 路线图

- [x] Phase 0：脚手架 + TS 7 工具链验证 + i18n 框架（en-US）+ CI
- [ ] Phase 1：布局（侧边栏/头部）+ Dashboard/Users/Tasks/Settings 页面 + mock 数据层范式
- [ ] Phase 2（可选）：SQLite 后端（Drizzle）+ 双库（SQLite/Postgres）CI 矩阵
- [ ] 发布 v1：纯前端可运行模板 + 中文文档 + 演示站

## 许可

MIT License

