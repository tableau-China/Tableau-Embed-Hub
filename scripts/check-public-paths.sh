#!/usr/bin/env bash
# check-public-paths.sh — 公开仓库路径守卫
#
# 目的：禁止内部项目内容（flows / foc / amro / clean-layer / sql-icon-map 等）进入公开仓库 main。
# 内部内容保留在本地 custom 分支，不提交到 main。
#
# ⚠️ 规则维护要点：**不要用 src/features/ 这类整目录前缀**。
#    src/features/ 下既有内部页（amro / clean-layer / flows / sql-icon-map），
#    也有公开页（config / help / permissions / profile）—— 整目录前缀会把「改一个公开页面」
#    误判成内部内容（该误报自 v0.7.0 起存在，2026-10-01 修正）。新增内部功能时只追加它自己的路径前缀。
#
# 自检（改了规则必跑）：
#   bash scripts/check-public-paths.sh        # 不给基线 = 全量 git ls-files 自检，应为 ✅
#   git diff --name-status main custom        # 内部文件清单（A = 仅 custom 有）
#
# 用法：由 GitHub Actions 调用（push 事件经 GITHUB_EVENT_BEFORE 传入基线 SHA；
#       PR 事件自动以 origin/main 为基线）。本地也可手动运行模拟。
set -euo pipefail

# 内部内容路径前缀（命中即拒绝）—— 新增内部功能时在此追加
FORBIDDEN_PREFIXES=(
  # ① 内部功能页（src/features 下这四个是内部；config/help/permissions/profile 是公开页）
  'src/features/amro/'
  'src/features/clean-layer/'
  'src/features/flows/'
  'src/features/sql-icon-map/'
  # ② 内部路由（前缀同时覆盖 flows.tsx 与 flows.amro.tsx 等同族文件）
  'src/routes/flows'
  'src/routes/t.$teamSlug.flows'
  # ③ 内部文档
  'docs/FOC_pipeline'
  'docs/flow-page-conventions'
  # ④ 内部脚本（抽取 / 构建 / 校验）
  'scripts/add-amro'
  'scripts/build-foc'
  'scripts/build-full-sql'
  'scripts/check-amro'
  'scripts/check-flow'
  'scripts/extract-clean-layer'
  'scripts/extract-flows'
  'scripts/lib/flow-graph-check'
  # ⑤ 框架同步与内部评审材料（只在 custom 线，不进 main）
  'GIT_SYNC.md'
  'scripts/sync-framework.sh'
  'docs/architecture-review.html'
  # ⑥ 诊断产物（仅 git add -f 时才会被跟踪，留作兜底）
  '.tmp-diag/'
)

# 计算本次变更基线
if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ]; then
  git fetch --depth=1 origin main
  BASE="origin/main"
elif [ -n "${GITHUB_EVENT_BEFORE:-}" ] && [ "${GITHUB_EVENT_BEFORE}" != "0000000000000000000000000000000000000000" ]; then
  BASE="${GITHUB_EVENT_BEFORE}"
else
  BASE="" # 无基线（如首次推送）：退化为检查全部已跟踪文件
fi

CHANGED=()
if [ -n "${BASE}" ]; then
  while IFS= read -r f; do CHANGED+=("$f"); done < <(git diff --name-only "${BASE}"...HEAD)
else
  while IFS= read -r f; do CHANGED+=("$f"); done < <(git ls-files)
fi

if [ ${#CHANGED[@]} -eq 0 ]; then
  echo "✅ 无变更文件"
  exit 0
fi

VIOLATIONS=()
for f in "${CHANGED[@]}"; do
  for p in "${FORBIDDEN_PREFIXES[@]}"; do
    if [[ "$f" == "$p"* ]]; then
      VIOLATIONS+=("$f  ← 命中规则 $p")
      break
    fi
  done
done

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo "❌ 检测到内部内容变更，禁止进入公开仓库："
  printf '   %s\n' "${VIOLATIONS[@]}"
  echo "内部内容（flows / foc / amro / clean-layer / sql-icon-map）属于 custom 分支，请勿推入 main。"
  echo "若这是误报：从 FORBIDDEN_PREFIXES 里去掉该前缀，并在本地跑一次无基线的全量自检确认。"
  exit 1
fi

echo "✅ 变更文件均在公开范围内（$(printf '%s ' "${CHANGED[@]}")）"
