#!/usr/bin/env bash
# check-public-paths.sh — 公开仓库路径守卫
#
# 目的：禁止内部项目内容（flows / amro / foc / clean-layer 等）进入公开仓库 main。
# 内部内容应保留在本地 custom 分支，勿推入 main。
#
# 用法：由 GitHub Actions 调用（push 事件经 GITHUB_EVENT_BEFORE 传入基线 SHA；
#       PR 事件自动以 origin/main 为基线）。本地也可手动运行模拟。
set -euo pipefail

# 内部内容路径前缀（命中即拒绝）—— 新增内部功能时在此追加
FORBIDDEN_PREFIXES=(
  'src/features/'
  'src/routes/flows'
  'docs/FOC_pipeline'
  'docs/flow-page-conventions'
  'scripts/build-foc'
  'scripts/build-full-sql'
  'scripts/extract-clean-layer'
  'scripts/add-amro'
  'scripts/check-amro'
  'scripts/check-flow'
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
      VIOLATIONS+=("$f")
      break
    fi
  done
done

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo "❌ 检测到内部内容变更，禁止进入公开仓库："
  printf '   %s\n' "${VIOLATIONS[@]}"
  echo "内部内容（flows / amro / foc / clean-layer 等）属于内部项目，请保留在 custom 分支，勿推入 main。"
  echo "如确需公开，请先从内部路径中移除后再提交。"
  exit 1
fi

echo "✅ 变更文件均在公开范围内（$(printf '%s ' "${CHANGED[@]}")）"
