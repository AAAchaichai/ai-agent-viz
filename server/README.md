# AI Agent Viz Server

AI Agent 可视化项目的后端服务，支持多模型接入和实时状态同步。

## 功能特性

- 🚀 **多模型支持**: OpenAI、Anthropic、Ollama、以及任何 OpenAI 兼容接口
- 📡 **实时通信**: SSE 和 WebSocket 实时状态同步
- 🔄 **流式响应**: 支持流式对话，实时显示 Agent 思考过程
- 🤖 **多 Agent 协作**: Agent 间可以互相发送消息
- 🎯 **状态可视化**: thinking/typing/success/error 等状态实时同步

## 快速开始

### 安装依赖

```bash
cd server
npm install
```

### 开发模式

```bash
npm run dev
# 或
npm run watch
```

### 生产模式

```bash
npm run build
npm start
```

## API 文档

### 模型管理

- `GET /api/models` - 获取预设模型列表和已创建的 Agents
- `POST /api/models/test` - 测试模型连接

### Agent 管理

- `GET /api/agents` - 获取所有 Agents
- `POST /api/agents` - 创建 Agent
- `DELETE /api/agents/:id` - 删除 Agent
- `GET /api/agents/:id/history` - 获取对话历史
- `DELETE /api/agents/:id/history` - 清空对话历史

### 对话

- `POST /api/chat/:agentId` - 发送消息（SSE 流式响应）
- `POST /api/agents/:fromId/chat/:toId` - Agent 间对话

### 实时流

- `GET /api/stream/:agentId` - SSE 状态流（agentId 为 all 时订阅所有）
- `WS /ws/agent` - WebSocket 实时通信

## 预设模型

- SiliconFlow (DeepSeek-V3)
- DeepSeek
- OpenAI
- Ollama (本地)
- Anthropic Claude

## 环境变量

```bash
PORT=3001          # 服务器端口
HOST=0.0.0.0       # 绑定地址
```
