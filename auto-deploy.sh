#!/bin/bash
# 自动部署脚本 - 提交并推送到 GitHub 触发自动部署

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 AI Agent Viz 自动部署脚本${NC}"
echo ""

# 检查是否有未提交的更改
if git diff --quiet HEAD; then
    echo -e "${YELLOW}⚠️ 没有检测到更改${NC}"
    read -p "是否仍要部署？ (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo "取消部署"
        exit 0
    fi
fi

# 显示更改摘要
echo -e "${YELLOW}📋 更改摘要:${NC}"
git status -s
echo ""

# 询问提交信息
if [ -z "$1" ]; then
    read -p "输入提交信息 (默认: 'Update from local'): " msg
    COMMIT_MSG=${msg:-"Update from local"}
else
    COMMIT_MSG="$1"
fi

echo ""
echo -e "${YELLOW}🔨 正在提交更改...${NC}"
git add -A
git commit -m "$COMMIT_MSG"

echo ""
echo -e "${YELLOW}📤 推送到 GitHub...${NC}"
git push origin main

echo ""
echo -e "${GREEN}✅ 推送成功！${NC}"
echo ""
echo -e "${BLUE}📦 GitHub Actions 将自动部署到:${NC}"
echo "   https://aaachaichai.github.io/ai-agent-viz/"
echo ""
echo -e "${YELLOW}⏳ 部署通常需要 1-2 分钟...${NC}"
echo ""
echo -e "${BLUE}查看部署状态:${NC}"
echo "   https://github.com/AAAchaichai/ai-agent-viz/actions"
