import type { ModelConfig, AgentInstance } from '../types';
import { apiClient } from '../api/apiClient';

/**
 * Agent 服务层 - 处理与服务器的数据交互
 * 将 API 调用从 Store 中分离，实现关注点分离
 */
export class AgentService {
  /**
   * 从服务器获取预设模型配置
   */
  static async fetchPresetModels(): Promise<{ presets: ModelConfig[] }> {
    return apiClient.getModels();
  }

  /**
   * 从服务器获取所有 Agent 实例
   */
  static async fetchAgents(): Promise<AgentInstance[]> {
    return apiClient.getAgents();
  }

  /**
   * 在服务器上创建新 Agent
   */
  static async createAgent(
    name: string, 
    modelConfig: ModelConfig
  ): Promise<{ success: boolean; agent?: AgentInstance }> {
    return apiClient.createAgent(name, modelConfig);
  }

  /**
   * 在服务器上删除 Agent
   */
  static async deleteAgent(id: string): Promise<void> {
    return apiClient.deleteAgent(id);
  }

  /**
   * 发送消息给指定 Agent
   */
  static async sendMessage(
    agentId: string,
    message: string,
    onChunk: (chunk: { content?: string }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    return apiClient.sendMessage(
      agentId,
      message,
      onChunk,
      onComplete,
      onError
    );
  }

  /**
   * 在 Agent 之间发送消息
   */
  static async sendMessageBetweenAgents(
    fromId: string,
    toId: string,
    message: string,
    onChunk: (chunk: { content?: string }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    return apiClient.sendMessageBetweenAgents(
      fromId,
      toId,
      message,
      onChunk,
      onComplete,
      onError
    );
  }
}
