# AI Agent Visualizer

一个将AI Agent可视化为像素角色的Web应用。Watch your AI agents come to life!

![Demo](demo.png)

## 特性

- 🎮 **Canvas 2D 渲染引擎** - 流畅的像素角色动画
- 🤖 **状态机驱动** - idle, typing, thinking, error, success 多种状态
- 💬 **OpenAI兼容API** - 支持任何OpenAI格式的API端点
- ⚡ **实时流式响应** - SSE实时状态推送
- 🎨 **程序化像素生成** - 无需外部资源即可生成像素角色

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 配置API

创建 `.env` 文件:

```env
VITE_OPENAI_API_KEY=your_api_key
VITE_OPENAI_BASE_URL=https://api.openai.com/v1
VITE_OPENAI_MODEL=gpt-3.5-turbo
```

### 构建

```bash
npm run build
```

## 技术栈

- React 18
- TypeScript
- Vite
- Canvas 2D API
- OpenAI Compatible API

## 项目结构

```
src/
├── api/              # API接口和SSE管理
│   ├── OpenAICompatibleAPI.ts
│   └── SSEManager.ts
├── components/       # React组件
│   ├── AgentCanvas.tsx
│   └── AgentCanvas.css
├── engine/           # 核心引擎
│   ├── AgentStateMachine.ts
│   ├── GameLoop.ts
│   └── SpriteRenderer.ts
├── types/            # TypeScript类型定义
│   └── index.ts
├── App.tsx
└── main.tsx
```

## 状态说明

| 状态 | 颜色 | 说明 |
|------|------|------|
| idle | 绿色 | 空闲等待 |
| typing | 蓝色 | 正在输出 |
| thinking | 黄色 | 思考处理中 |
| error | 红色 | 发生错误 |
| success | 青绿 | 任务完成 |

## GitHub Pages 部署

项目已配置GitHub Actions自动部署。推送到main分支将自动触发部署。

访问地址: https://yourusername.github.io/ai-agent-viz/

## 许可证

MIT

## 致谢

- 灵感来源于 [pixel-agents](https://github.com/pablodelucca/pixel-agents)
