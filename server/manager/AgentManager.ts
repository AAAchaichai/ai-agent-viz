import { randomUUID } from 'crypto';
import type { AgentInstance, Message, ModelConfig, AgentStatus, SSEEvent } from '../types.js';
import { AdapterFactory } from '../adapters/index.js';
import { BaseAdapter } from '../adapters/BaseAdapter.js';

// SSE 事件监听者
type EventListener = (event: SSEEvent) => void;

export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private adapters: Map<string, BaseAdapter> = new Map();
  private eventListeners: EventListener[] = [];

  // 创建 Agent
  createAgent(name: string, modelConfig: ModelConfig): AgentInstance {
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
  removeAgent(id: string): boolean {
    const deleted = this.agents.delete(id);
    if (deleted) {
      this.adapters.delete(id);
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
