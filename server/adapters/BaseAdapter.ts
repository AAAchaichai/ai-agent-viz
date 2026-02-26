import type { Message, ChatResponse, StreamChunk, AgentStatus, ModelConfig } from '../types.ts';

export abstract class BaseAdapter {
  protected config: ModelConfig;
  protected currentStatus: AgentStatus = 'idle';
  protected statusListeners: Array<(status: AgentStatus) => void> = [];

  constructor(config: ModelConfig) {
    this.config = config;
  }

  // 抽象方法：普通对话
  abstract chat(messages: Message[]): Promise<ChatResponse>;

  // 抽象方法：流式对话
  abstract streamChat(messages: Message[]): AsyncGenerator<StreamChunk, void, unknown>;

  // 获取当前状态
  getStatus(): AgentStatus {
    return this.currentStatus;
  }

  // 设置状态并通知监听者
  protected setStatus(status: AgentStatus): void {
    this.currentStatus = status;
    this.notifyStatusChange(status);
  }

  // 订阅状态变化
  onStatusChange(callback: (status: AgentStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      const index = this.statusListeners.indexOf(callback);
      if (index > -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  // 通知所有监听者
  protected notifyStatusChange(status: AgentStatus): void {
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Status listener error:', error);
      }
    });
  }

  // 获取模型信息
  getModelInfo(): { provider: string; model: string; name: string } {
    return {
      provider: this.config.provider,
      model: this.config.model,
      name: this.config.name
    };
  }

  // 验证配置
  abstract validateConfig(): Promise<boolean>;

  // 测试连接
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const isValid = await this.validateConfig();
      if (!isValid) {
        return { success: false, message: '配置验证失败' };
      }

      // 发送一个简单的测试消息
      const testMessages: Message[] = [
        { role: 'user', content: 'Hello, this is a test.' }
      ];
      
      const response = await this.chat(testMessages);
      
      return { 
        success: true, 
        message: `连接成功！模型响应: "${response.content.slice(0, 50)}..."` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `连接失败: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
}
