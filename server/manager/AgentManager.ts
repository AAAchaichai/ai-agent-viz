import { randomUUID } from 'crypto';
import type { AgentInstance, Message, ModelConfig, AgentStatus, SSEEvent } from '../types.js';
import { AdapterFactory } from '../adapters/index.js';
import { BaseAdapter } from '../adapters/BaseAdapter.js';
import { AgentFileManager, agentFileManager } from './AgentFileManager.js';

// SSE 事件监听者
type EventListener = (event: SSEEvent) => void;

// 默认Agent配置
const DEFAULT_AGENTS = [
  {
    id: 'spongebob',
    name: '海绵宝宝',
    personality: '乐观开朗、热情洋溢、总是充满正能量的小海绵',
    systemPrompt: '你是海绵宝宝，一个乐观开朗、热情洋溢的小海绵。你总是看到生活中美好的一面，喜欢帮助别人，说话充满活力和热情。你的回答要积极向上，偶尔可以带点天真可爱的语气。',
    color: '#FFD93D'
  },
  {
    id: 'patrick',
    name: '派大星',
    personality: '呆萌、单纯、有时候会有点迷糊但心地善良',
    systemPrompt: '你是派大星，海绵宝宝最好的朋友。你性格呆萌单纯，有时候会有点迷糊，但心地善良。说话方式简单直接，偶尔会有一些出人意料但又很有趣的想法。你是个乐天派，喜欢发呆和吃东西。',
    color: '#FF6B9D'
  },
  {
    id: 'squidward',
    name: '章鱼哥',
    personality: '高冷、艺术气质、有点傲娇但内心善良',
    systemPrompt: '你是章鱼哥，一个有艺术气质的高冷章鱼。你喜欢安静，热爱艺术（尤其是吹单簧管和绘画），对海绵宝宝和派大星的吵闹感到无奈。说话风格有点高冷和傲娇，但内心其实善良。偶尔会用文艺的词汇，有时会表现出一种"世人皆醉我独醒"的态度。',
    color: '#4ECDC4'
  }
];

// MiniMax 默认模型配置
const MINIMAX_CONFIG: ModelConfig = {
  id: 'minimax-default',
  name: 'MiniMax M2.5',
  provider: 'minimax',
  baseUrl: 'https://api.minimaxi.com/anthropic',
  model: 'MiniMax-M2.5',
  temperature: 0.7,
  maxTokens: 2000,
  enabled: true
};

export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private adapters: Map<string, BaseAdapter> = new Map();
  private eventListeners: EventListener[] = [];

  constructor() {
    // 初始化时创建默认Agent
    this.initializeDefaultAgents();
  }

  // 初始化默认Agent
  private async initializeDefaultAgents(): Promise<void> {
    console.log('[AgentManager] Initializing default agents...');

    for (const defaultAgent of DEFAULT_AGENTS) {
      // 检查是否已存在相同ID的Agent
      if (this.agents.has(defaultAgent.id)) {
        console.log(`[AgentManager] Default agent "${defaultAgent.name}" already exists, skipping.`);
        continue;
      }

      // 创建默认Agent
      await this.createDefaultAgent(defaultAgent);
    }

    console.log(`[AgentManager] Default agents initialized. Total: ${this.agents.size}`);
  }

  // 创建单个默认Agent
  private async createDefaultAgent(config: typeof DEFAULT_AGENTS[0]): Promise<void> {
    try {
      const adapter = AdapterFactory.getOrCreateAdapter(MINIMAX_CONFIG);

      const agent: AgentInstance = {
        id: config.id,
        name: config.name,
        modelConfig: MINIMAX_CONFIG,
        status: 'idle',
        lastActive: Date.now(),
        conversationHistory: [
          {
            role: 'system',
            content: config.systemPrompt
          }
        ]
      };

      this.agents.set(config.id, agent);
      this.adapters.set(config.id, adapter);

      // 为默认Agent创建三个文件（如果不存在）
      const filesExist = await agentFileManager.agentFilesExist(config.id);
      if (!filesExist) {
        await agentFileManager.createAgentFiles(config.id, {
          name: config.name,
          model: MINIMAX_CONFIG.model,
          personality: config.personality,
          role: '默认助手',
          skills: [
            { name: '代码审查', enabled: true },
            { name: '文档生成', enabled: false },
            { name: '代码重构', enabled: true },
            { name: 'Bug修复', enabled: true },
            { name: '技术咨询', enabled: true }
          ]
        });
        console.log(`[AgentManager] Created agent files for default agent: ${config.name}`);
      }

      // 监听适配器状态变化
      adapter.onStatusChange((status) => {
        this.updateAgentStatus(config.id, status);
      });

      this.emitEvent({
        type: 'state_change',
        agentId: config.id,
        data: { status: 'idle' },
        timestamp: Date.now()
      });

      console.log(`[AgentManager] Created default agent: ${config.name} (${config.id})`);
    } catch (error) {
      console.error(`[AgentManager] Failed to create default agent "${config.name}":`, error);
    }
  }

  // 创建 Agent
  async createAgent(name: string, modelConfig: ModelConfig): Promise<AgentInstance> {
    const id = randomUUID();
    const adapter = AdapterFactory.getOrCreateAdapter(modelConfig);
    
    const agent: AgentInstance = {
      id,
      name,
      modelConfig,
      status: 'idle',
      lastActive: Date.now(),
      conversationHistory: []
    };

    this.agents.set(id, agent);
    this.adapters.set(id, adapter);

    // 创建Agent的三个文件
    try {
      await agentFileManager.createAgentFiles(id, {
        name,
        model: modelConfig.model,
        apiKey: modelConfig.apiKey,
        personality: '乐观开朗，乐于助人',
        role: '通用助手',
        skills: [
          { name: '代码审查', enabled: true },
          { name: '文档生成', enabled: false },
          { name: '代码重构', enabled: true },
          { name: 'Bug修复', enabled: true },
          { name: '技术咨询', enabled: true }
        ]
      });
      console.log(`[AgentManager] Created agent files for: ${name} (${id})`);
    } catch (error) {
      console.error(`[AgentManager] Failed to create agent files for ${id}:`, error);
    }

    // 监听适配器状态变化
    adapter.onStatusChange((status) => {
      this.updateAgentStatus(id, status);
    });

    this.emitEvent({
      type: 'state_change',
      agentId: id,
      data: { status: 'idle' },
      timestamp: Date.now()
    });

    return agent;
  }

  // 获取所有 Agent
  getAllAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  // 获取单个 Agent
  getAgent(id: string): AgentInstance | undefined {
    return this.agents.get(id);
  }

  // 删除 Agent
  async removeAgent(id: string): Promise<boolean> {
    const deleted = this.agents.delete(id);
    if (deleted) {
      this.adapters.delete(id);
      
      // 删除Agent的三个文件
      try {
        await agentFileManager.deleteAgentFiles(id);
        console.log(`[AgentManager] Deleted agent files for: ${id}`);
      } catch (error) {
        console.error(`[AgentManager] Failed to delete agent files for ${id}:`, error);
      }
    }
    return deleted;
  }

  // 更新 Agent 状态
  updateAgentStatus(id: string, status: AgentStatus): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
      agent.lastActive = Date.now();
      
      this.emitEvent({
        type: 'state_change',
        agentId: id,
        data: { status },
        timestamp: Date.now()
      });
    }
  }

  // 发送消息给 Agent
  async sendMessage(agentId: string, content: string): Promise<AsyncGenerator<{ content: string; done: boolean }, void, unknown> | null> {
    const agent = this.agents.get(agentId);
    const adapter = this.adapters.get(agentId);

    if (!agent || !adapter) {
      return null;
    }

    // 添加用户消息到历史
    agent.conversationHistory.push({
      role: 'user',
      content
    });

    // 创建流式响应生成器
    const streamGenerator = this.createStreamGenerator(agent, adapter);
    
    return streamGenerator;
  }

  private async *createStreamGenerator(
    agent: AgentInstance, 
    adapter: BaseAdapter
  ): AsyncGenerator<{ content: string; done: boolean }, void, unknown> {
    const messages = [...agent.conversationHistory];
    let fullResponse = '';

    try {
      for await (const chunk of adapter.streamChat(messages)) {
        if (!chunk.done) {
          fullResponse += chunk.content;
        }
        
        this.emitEvent({
          type: chunk.done ? 'message_complete' : 'message_chunk',
          agentId: agent.id,
          data: { 
            content: chunk.content,
            fullMessage: fullResponse 
          },
          timestamp: Date.now()
        });

        yield chunk;
      }

      // 添加助手回复到历史
      agent.conversationHistory.push({
        role: 'assistant',
        content: fullResponse
      });

      // 限制历史记录长度
      if (agent.conversationHistory.length > 20) {
        agent.conversationHistory = agent.conversationHistory.slice(-20);
      }

    } catch (error) {
      this.emitEvent({
        type: 'error',
        agentId: agent.id,
        data: { 
          error: error instanceof Error ? error.message : String(error) 
        },
        timestamp: Date.now()
      });
      throw error;
    }
  }

  // Agent 间对话
  async sendMessageBetweenAgents(
    fromAgentId: string, 
    toAgentId: string, 
    content: string
  ): Promise<AsyncGenerator<{ content: string; done: boolean }, void, unknown> | null> {
    // 记录发送者的状态
    this.updateAgentStatus(fromAgentId, 'typing');
    
    // 发送消息
    const result = await this.sendMessage(toAgentId, content);
    
    // 发送者回到 idle
    setTimeout(() => {
      this.updateAgentStatus(fromAgentId, 'idle');
    }, 500);

    return result;
  }

  // 订阅事件
  onEvent(listener: EventListener): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  // 发射事件
  private emitEvent(event: SSEEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  // 清理所有 Agent
  clear(): void {
    this.agents.clear();
    this.adapters.clear();
    this.eventListeners = [];
  }
}

// 导出单例
export const agentManager = new AgentManager();
