#!/bin/bash
# 部署脚本 - Railway 一键部署

set -e

echo "🚀 开始部署 AI Agent 总指挥系统..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查环境
echo -e "${YELLOW}检查环境...${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: Node.js 未安装${NC}"
    exit 1
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: npm 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 环境检查通过${NC}"

# 安装依赖
echo -e "${YELLOW}安装前端依赖...${NC}"
npm ci

echo -e "${YELLOW}安装服务端依赖...${NC}"
cd server
npm ci
cd ..

# 构建项目
echo -e "${YELLOW}构建项目...${NC}"
npm run build

echo -e "${GREEN}✓ 构建完成${NC}"

# 检查 Railway CLI（可选）
if command -v railway &> /dev/null; then
    echo -e "${YELLOW}检测到 Railway CLI${NC}"
    echo -e "${GREEN}运行 'railway up' 部署到 Railway${NC}"
else
    echo -e "${YELLOW}未检测到 Railway CLI${NC}"
    echo -e "${YELLOW}请手动上传项目到 Railway 或使用 GitHub 集成${NC}"
fi

echo -e "${GREEN}✅ 部署准备完成！${NC}"
echo ""
echo "📦 构建产物:"
echo "  - 前端: dist/"
echo "  - 服务端: server/dist/"
echo ""
echo "🚀 启动命令:"
echo "  npm run start"
echo ""
