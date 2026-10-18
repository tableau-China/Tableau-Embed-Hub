# syntax=docker/dockerfile:1
#
# Tableau Embed Hub 生产镜像（纯静态 SPA：Node 构建 → nginx 运行）
#
# 构建（VITE_* 是**构建期**变量，必须在这里传，运行时 -e 无效）：
#   docker build -t tableau-embed-hub:0.13.3 \
#     --build-arg VITE_TABLEAU_SERVER_URL=https://your-site.online.tableau.com \
#     --build-arg VITE_TABLEAU_SITE_NAME=your_site \
#     --build-arg VITE_TABLEAU_SITE_CONTENT_URL=your_site \
#     --build-arg VITE_TABLEAU_EMBED_USER=embed-user@example.com \
#     --build-arg VITE_TABLEAU_CLIENT_ID=... \
#     --build-arg VITE_TABLEAU_SECRET_ID=... \
#     --build-arg VITE_TABLEAU_SECRET_VALUE=... \
#     --build-arg VITE_ERROR_REPORT_URL=https://errors.example.com/collect \
#     .
#
# 运行：
#   docker run --rm -p 8080:80 tableau-embed-hub:0.13.3
#   curl -fsS http://127.0.0.1:8080/healthz
#
# ⚠️ 纯前端无法保管 secret：build-arg 会出现在镜像历史里，且值会内联进 JS bundle。
#    生产环境的 Tableau 凭据策略与替代方案见 docs/tableau-setup.md 与 docs/deployment.md。
#
# 构建阶段与本地/CI 使用同一条 `pnpm build`（tsc -b + vite build），保证产物一致；
# pnpm 版本与 package.json 的 packageManager 保持一致（改一处要改两处）。
FROM node:24-alpine AS build

ARG PNPM_VERSION=12.9.1
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm --version

WORKDIR /app

# 依赖层：业务代码变动不会重新安装依赖
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# ---- 构建期环境变量（默认空串；留空 = 应用内置演示值 / 不上报错误） ----
ARG VITE_TABLEAU_SERVER_URL=""
ARG VITE_TABLEAU_SITE_NAME=""
ARG VITE_TABLEAU_SITE_CONTENT_URL=""
ARG VITE_TABLEAU_EMBED_USER=""
ARG VITE_TABLEAU_PROJECT=""
ARG VITE_TABLEAU_FALLBACK_VIEW=""
ARG VITE_TABLEAU_API_VERSION=""
ARG VITE_TABLEAU_API_BASE=""
ARG VITE_TABLEAU_CLIENT_ID=""
ARG VITE_TABLEAU_SECRET_ID=""
ARG VITE_TABLEAU_SECRET_VALUE=""
ARG VITE_AI_PROXY_URL=""
ARG VITE_AI_MODEL=""
ARG VITE_AI_SYSTEM_PROMPT=""
ARG VITE_ERROR_REPORT_URL=""
ENV VITE_TABLEAU_SERVER_URL="${VITE_TABLEAU_SERVER_URL}" \
    VITE_TABLEAU_SITE_NAME="${VITE_TABLEAU_SITE_NAME}" \
    VITE_TABLEAU_SITE_CONTENT_URL="${VITE_TABLEAU_SITE_CONTENT_URL}" \
    VITE_TABLEAU_EMBED_USER="${VITE_TABLEAU_EMBED_USER}" \
    VITE_TABLEAU_PROJECT="${VITE_TABLEAU_PROJECT}" \
    VITE_TABLEAU_FALLBACK_VIEW="${VITE_TABLEAU_FALLBACK_VIEW}" \
    VITE_TABLEAU_API_VERSION="${VITE_TABLEAU_API_VERSION}" \
    VITE_TABLEAU_API_BASE="${VITE_TABLEAU_API_BASE}" \
    VITE_TABLEAU_CLIENT_ID="${VITE_TABLEAU_CLIENT_ID}" \
    VITE_TABLEAU_SECRET_ID="${VITE_TABLEAU_SECRET_ID}" \
    VITE_TABLEAU_SECRET_VALUE="${VITE_TABLEAU_SECRET_VALUE}" \
    VITE_AI_PROXY_URL="${VITE_AI_PROXY_URL}" \
    VITE_AI_MODEL="${VITE_AI_MODEL}" \
    VITE_AI_SYSTEM_PROMPT="${VITE_AI_SYSTEM_PROMPT}" \
    VITE_ERROR_REPORT_URL="${VITE_ERROR_REPORT_URL}"

RUN pnpm build

# ---------------------------------------------------------------------------
# 运行阶段：nginx 官方镜像（体积小；无 node 运行时）
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.container.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# /healthz 由 nginx 固定返回 200（只表示进程存活，不校验 Tableau / AI 下游）
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

EXPOSE 80
