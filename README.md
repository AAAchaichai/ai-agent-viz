# AI Agent Visualizer

AI Agent 可视化项目 - 多模型集成与实时状态同步

## 功能特性

- 🤖 **多模型支持**: OpenAI、Anthropic、Ollama、SiliconFlow、DeepSeek 等
- 📡 **实时通信**: WebSocket + SSE 实时状态同步
- 🔄 **流式响应**: 实时显示 Agent 思考过程
- 🎮 **可视化**: 像素风格 Agent 状态可视化
- 💬 **消息气泡**: 实时显示对话消息气泡
- 🔗 **连线动画**: 消息传递时的流动连线动画
- 🤝 **多 Agent 协作**: Agent 间可以互相发送消息
- 🎬 **协作演示**: 一键启动多 Agent 对话演示
- 🎯 **状态机**: idle/thinking/typing/success/error 状态实时同步

## 技术栈

- **前端**: React + TypeScript + Vite + Zustand + Canvas 2D
- **后端**: Fastify + WebSocket + SSE + TypeScript
- **模型适配**: OpenAI 兼容接口、Anthropic、Ollama

## 快速开始

### 1. 安装依赖

```bash
# 根目录（前端）
npm install

# 后端
cd server
npm install
cd ..
```

### 2. 启动服务

#### 方式一：同时启动前后端（推荐开发使用）

```bash
npm run dev:all
```

#### 方式二：分别启动

启动后端：
```bash
npm run server
# 或
cd server && npm run dev
```

启动前端：
```bash
npm run dev
```

### 3. 访问应用

- 前端: http://localhost:5173
- 后端: http://localhost:3001

## 使用指南

### 添加 Agent

1. 点击右上角 **"+ 添加 Agent"** 按钮
2. 选择模型提供商（SiliconFlow、DeepSeek、OpenAI 等）
3. 填写配置信息：
   - Agent 名称
   - API Base URL
   - API Key
   - 模型名称
4. 点击 **"测试连接"** 验证配置
5. 点击 **"创建 Agent"**

### 与 Agent 对话

1. 点击场景中的 Agent 选中它
2. 在右侧面板输入消息并发送
3. 观察 Agent 状态变化和实时响应

### 多 Agent 协作

1. 创建两个或更多 Agent
2. 选中一个 Agent
3. 在右侧面板点击 **"向 xxx 提问"**
4. 观察消息传递和响应流程

### 演示模式

点击 **"▶ 协作演示"** 按钮，观看两个 Agent 自动对话：
- Agent A 提问（thinking → typing → 发送）
- 消息传递到 Agent B
- Agent B 思考（thinking → typing → 回复）
- 消息气泡和连线动画全程可视化

点击 **"⏹ 停止演示"** 可提前结束演示。

## API 文档

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/models` | 获取预设模型列表 |
| GET | `/api/agents` | 获取所有 Agents |
| POST | `/api/agents` | 创建 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |
| POST | `/api/chat/:agentId` | 发送消息（流式） |
| POST | `/api/agents/:fromId/chat/:toId` | Agent 间对话 |
| GET | `/api/stream/:agentId` | SSE 状态流 |
| WS | `/ws/agent` | WebSocket 实时通信 |

### 预设模型

- SiliconFlow (DeepSeek-V3)
- DeepSeek
- OpenAI
- Ollama (本地)
- Anthropic Claude

## 项目结构

```
ai-agent-viz/
├── src/                       # 前端代码
│   ├── api/                  # API 客户端
│   │   ├── apiClient.ts
│   │   ├── sseClient.ts
│   │   ├── webSocketClient.ts
│   │   └── useAgentStatus.ts
│   ├── components/           # UI 组件
│   │   ├── AgentPanel.tsx       # Agent 详情面板
│   │   ├── APIKeyInput.tsx      # API Key 输入组件
│   │   ├── ConnectionStatus.tsx # 连接状态指示器
│   │   ├── ModelConfigModal.tsx # 模型配置弹窗
│   │   └── ModelSelector.tsx    # 模型选择器
│   ├── engine/               # 渲染引擎
│   │   ├── CanvasEngine.ts
│   │   ├── ConnectionRenderer.ts # 连线动画
│   │   ├── MessageRenderer.ts    # 消息气泡
│   │   ├── PixelAgentRenderer.ts
│   │   └── ThoughtBubbleRenderer.ts
│   ├── scenes/               # 场景
│   ├── store/                # 状态管理
│   └── types/                # 类型定义
├── server/                    # 后端服务
│   ├── adapters/             # 模型适配器
│   ├── manager/              # Agent 管理
│   ├── routes/               # API 路由
│   └── index.ts              # 服务器入口
└── package.json
```

## 环境变量

创建 `.env.local` 文件：

```bash
VITE_API_URL=http://localhost:3001
```

## 开发计划

- [x] Canvas 渲染引擎
- [x] 像素小人状态可视化
- [x] 办公室场景基础
- [x] 后端服务搭建
- [x] 模型适配器系统
- [x] Fastify API 服务器
- [x] 前端 API 集成
- [x] 模型配置 UI（弹窗、选择器、API Key 输入）
- [x] 消息可视化（消息气泡）
- [x] 连线动画（消息传递连线）
- [x] 多 Agent 协作演示
- [ ] 更多动画效果
- [ ] 消息历史持久化
- [ ] 团队协作场景

## 许可证

MIT
# Trigger redeploy Thu Feb 26 12:33:12 PM CST 2026
# Trigger deploy Thu Feb 26 12:58:26 PM CST 2026
