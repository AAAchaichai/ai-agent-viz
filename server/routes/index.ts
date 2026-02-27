import { FastifyInstance } from 'fastify';
import { agentManager } from '../manager/AgentManager.js';
import { agentFileManager } from '../manager/AgentFileManager.js';
import { AdapterFactory, presetModels } from '../adapters/index.js';
import type { ModelConfig } from '../types.ts';
import { registerMasterRoutes } from './master.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // 注册总指挥系统路由
  await registerMasterRoutes(fastify);
  
  // 健康检查端点
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: '1.0.0'
    };
  });

  // 获取预设模型列表
  fastify.get('/api/models', async () => {
    return {
      presets: presetModels,
      agents: agentManager.getAllAgents().map(agent => ({
        id: agent.id,
        name: agent.name,
        model: agent.modelConfig.name,
        status: agent.status
      }))
    };
  });

  // 创建 Agent
  fastify.post('/api/agents', async (request, reply) => {
    const body = request.body as {
      name: string;
      modelConfig: ModelConfig;
    };

    if (!body.name || !body.modelConfig) {
      reply.status(400);
      return { error: 'Missing required fields: name, modelConfig' };
    }

    try {
      const agent = await agentManager.createAgent(body.name, body.modelConfig);
      return { success: true, agent };
    } catch (error) {
      reply.status(500);
      return { 
        error: 'Failed to create agent',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // 删除 Agent
  fastify.delete('/api/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await agentManager.removeAgent(id);
    
    if (!success) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    return { success: true };
  });

  // 获取所有 Agents
  fastify.get('/api/agents', async () => {
    return agentManager.getAllAgents();
  });

  // 测试模型连接
  fastify.post('/api/models/test', async (request, reply) => {
    const config = request.body as ModelConfig;
    
    try {
      const adapter = AdapterFactory.createAdapter(config);
      const result = await adapter.testConnection();
      return result;
    } catch (error) {
      reply.status(500);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // 发送消息（流式）
  fastify.post('/api/chat/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const { message } = request.body as { message: string };

    if (!message) {
      reply.status(400);
      return { error: 'Missing required field: message' };
    }

    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      const stream = await agentManager.sendMessage(agentId, message);
      
      if (!stream) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Failed to start stream' })}\n\n`);
        reply.raw.end();
        return;
      }

      for await (const chunk of stream) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      reply.raw.end();
    } catch (error) {
      reply.raw.write(`data: ${JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error) 
      })}\n\n`);
      reply.raw.end();
    }
  });

  // Agent 间对话
  fastify.post('/api/agents/:fromId/chat/:toId', async (request, reply) => {
    const { fromId, toId } = request.params as { fromId: string; toId: string };
    const { message } = request.body as { message: string };

    if (!message) {
      reply.status(400);
      return { error: 'Missing required field: message' };
    }

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      const stream = await agentManager.sendMessageBetweenAgents(fromId, toId, message);
      
      if (!stream) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Failed to start stream' })}\n\n`);
        reply.raw.end();
        return;
      }

      for await (const chunk of stream) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      reply.raw.end();
    } catch (error) {
      reply.raw.write(`data: ${JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error) 
      })}\n\n`);
      reply.raw.end();
    }
  });

  // SSE 状态流
  fastify.get('/api/stream/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const unsubscribe = agentManager.onEvent((event) => {
      if (event.agentId === agentId || agentId === 'all') {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    });

    // 发送心跳
    const heartbeat = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
    }, 30000);

    // 清理
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // 获取 Agent 对话历史
  fastify.get('/api/agents/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    return { history: agent.conversationHistory };
  });

  // 清空 Agent 对话历史
  fastify.delete('/api/agents/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    agent.conversationHistory = [];
    return { success: true };
  });

  // ========== Agent 文件管理路由 ==========

  // 获取 Agent 灵魂文件
  fastify.get('/api/agents/:id/soul', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    const soul = await agentFileManager.readSoulFile(id);
    if (!soul) {
      reply.status(404);
      return { error: 'Soul file not found' };
    }
    
    return soul;
  });

  // 更新 Agent 灵魂文件
  fastify.put('/api/agents/:id/soul', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    const data = request.body as Partial<{
      name: string;
      model: string;
      apiKeyEncrypted: string;
      personality: string;
      role: string;
    }>;
    
    const updated = await agentFileManager.updateSoulFile(id, data);
    if (!updated) {
      reply.status(500);
      return { error: 'Failed to update soul file' };
    }
    
    return { success: true, soul: updated };
  });

  // 获取 Agent 技能文件
  fastify.get('/api/agents/:id/skills', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    const skills = await agentFileManager.readSkillsFile(id);
    if (!skills) {
      reply.status(404);
      return { error: 'Skills file not found' };
    }
    
    return skills;
  });

  // 更新 Agent 技能文件
  fastify.put('/api/agents/:id/skills', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    const { skills } = request.body as { skills: Array<{ name: string; enabled: boolean }> };
    
    if (!skills || !Array.isArray(skills)) {
      reply.status(400);
      return { error: 'Missing required field: skills (array)' };
    }
    
    const updated = await agentFileManager.updateSkillsFile(id, skills);
    if (!updated) {
      reply.status(500);
      return { error: 'Failed to update skills file' };
    }
    
    return { success: true, skills: updated };
  });

  // 获取 Agent 记忆文件
  fastify.get('/api/agents/:id/memory', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    const memory = await agentFileManager.readMemoryFile(id);
    if (!memory) {
      reply.status(404);
      return { error: 'Memory file not found' };
    }
    
    return memory;
  });

  // 更新 Agent 记忆文件
  fastify.put('/api/agents/:id/memory', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    const data = request.body as Partial<{
      memories: string[];
      workFiles: string[];
      conversations: Array<{ id: string; timestamp: number; content: string }>;
    }>;
    
    const updated = await agentFileManager.updateMemoryFile(id, data);
    if (!updated) {
      reply.status(500);
      return { error: 'Failed to update memory file' };
    }
    
    return { success: true, memory: updated };
  });

  // 添加记忆
  fastify.post('/api/agents/:id/memory/add', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    const { memory } = request.body as { memory: string };
    
    if (!memory) {
      reply.status(400);
      return { error: 'Missing required field: memory' };
    }
    
    const updated = await agentFileManager.addMemory(id, memory);
    if (!updated) {
      reply.status(500);
      return { error: 'Failed to add memory' };
    }
    
    return { success: true, memory: updated };
  });

  // 添加工作文件
  fastify.post('/api/agents/:id/memory/workfile', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }
    
    const { filePath } = request.body as { filePath: string };
    
    if (!filePath) {
      reply.status(400);
      return { error: 'Missing required field: filePath' };
    }
    
    const updated = await agentFileManager.addWorkFile(id, filePath);
    if (!updated) {
      reply.status(500);
      return { error: 'Failed to add work file' };
    }
    
    return { success: true, memory: updated };
  });
}
