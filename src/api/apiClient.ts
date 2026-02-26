import type { ModelConfig, AgentInstance } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ChatChunk {
  content: string;
  done: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // 获取模型列表
  async getModels(): Promise<{ presets: ModelConfig[]; agents: any[] }> {
    const response = await fetch(`${this.baseUrl}/api/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    return response.json();
  }

  // 创建 Agent
  async createAgent(name: string, modelConfig: ModelConfig): Promise<{ success: boolean; agent: AgentInstance }> {
    const response = await fetch(`${this.baseUrl}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, modelConfig })
    });
    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }
    return response.json();
  }

  // 获取所有 Agents
  async getAgents(): Promise<AgentInstance[]> {
    const response = await fetch(`${this.baseUrl}/api/agents`);
    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    return response.json();
  }

  // 删除 Agent
  async deleteAgent(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/agents/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to delete agent: ${response.statusText}`);
    }
    return response.json();
  }

  // 测试模型连接
  async testModelConnection(config: ModelConfig): Promise<TestConnectionResult> {
    const response = await fetch(`${this.baseUrl}/api/models/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) {
      throw new Error(`Failed to test connection: ${response.statusText}`);
    }
    return response.json();
  }

  // 发送消息（返回取消函数）
  async sendMessage(
    agentId: string, 
    message: string, 
    onChunk: (chunk: ChatChunk) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    // 使用 fetch 读取流式响应
    const response = await fetch(`${this.baseUrl}/api/chat/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is null');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const chunk: ChatChunk = JSON.parse(data);
                onChunk(chunk);
                if (chunk.done) {
                  onComplete();
                  return;
                }
              } catch (e) {
                console.error('Failed to parse chunk:', e);
              }
            }
          }
        }
        onComplete();
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    processStream();

    // 返回取消函数
    return () => {
      reader.cancel();
    };
  }

  // Agent 间对话
  async sendMessageBetweenAgents(
    fromAgentId: string,
    toAgentId: string,
    message: string,
    onChunk: (chunk: ChatChunk) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    const response = await fetch(`${this.baseUrl}/api/agents/${fromAgentId}/chat/${toAgentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is null');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const chunk: ChatChunk = JSON.parse(data);
                onChunk(chunk);
                if (chunk.done) {
                  onComplete();
                  return;
                }
              } catch (e) {
                console.error('Failed to parse chunk:', e);
              }
            }
          }
        }
        onComplete();
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    processStream();

    return () => {
      reader.cancel();
    };
  }

  // 获取对话历史
  async getAgentHistory(agentId: string): Promise<{ history: any[] }> {
    const response = await fetch(`${this.baseUrl}/api/agents/${agentId}/history`);
    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.statusText}`);
    }
    return response.json();
  }

  // 清空对话历史
  async clearAgentHistory(agentId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/agents/${agentId}/history`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to clear history: ${response.statusText}`);
    }
    return response.json();
  }
}

export const apiClient = new ApiClient();
export default ApiClient;
