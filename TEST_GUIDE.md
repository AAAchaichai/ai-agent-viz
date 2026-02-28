# MasterAgent 前端模拟测试指南

## 问题诊断

### 已发现的问题
1. **MINIMAX_CONFIG 缺少 apiKey** - 已修复，添加了 `apiKey: process.env.MINIMAX_API_KEY || ''`
2. **parseAnalysisResponse 吞掉错误** - 已修复，解析失败现在抛出错误而不是返回默认配置

### 如何验证修复

#### 1. 检查后端服务是否运行
```bash
cd ai-agent-viz/server
npm run dev
```

#### 2. 检查环境变量
确保设置了 MiniMax API Key：
```bash
export MINIMAX_API_KEY="你的API密钥"
```

#### 3. 测试 API 连接
```bash
# 在服务器目录下运行测试
cd ai-agent-viz
npx tsx test-master-api.ts
```

#### 4. 手动测试前端

打开浏览器开发者工具 (F12)，在控制台执行：

```javascript
// 测试分析任务
fetch('/api/master/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: '帮我写一个计算斐波那契数列的Python函数'
  })
})
.then(r => r.json())
.then(data => console.log(data))
.catch(e => console.error(e));
```

### 预期行为

#### 成功情况
- 返回包含 complexity、estimatedTime、subtasks 等字段的 JSON
- 子任务应该有具体的 title、description、priority 等

#### 失败情况
- 如果 API Key 未配置，应该返回错误："任务分析失败: apiKey is required"
- 如果 API 调用失败，应该返回具体的错误信息

### 常见问题和解决

| 问题 | 原因 | 解决 |
|------|------|------|
| 返回固定格式（默认配置） | parseAnalysisResponse 吞掉了错误 | 已修复，现在会抛出错误 |
| API Key 错误 | MINIMAX_API_KEY 环境变量未设置 | 设置环境变量 |
| 网络错误 | 后端服务未启动或地址错误 | 检查服务状态和 API_BASE_URL |

### 修复提交记录
- `d5e9bc3` - fix: MasterAgent MiniMax API Key 和错误处理修复
