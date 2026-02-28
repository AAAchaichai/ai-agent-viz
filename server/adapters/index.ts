import type { ModelConfig, AgentStatus } from '../types.js';
import { BaseAdapter } from './BaseAdapter.js';
import { OpenAIAdapter } from './OpenAIAdapter.js';
import { OllamaAdapter } from './OllamaAdapter.js';
import { AnthropicAdapter } from './AnthropicAdapter.js';
import { MinimaxAdapter } from './MinimaxAdapter.js';

// 预设的模型配置
export const presetModels: ModelConfig[] = [
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    provider: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'minimax',
    name: 'MiniMax M2.5',
    provider: 'minimax',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    model: 'MiniMax-M2.5',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: true
  }
];

export class AdapterFactory {
  private static instances: Map<string, BaseAdapter> = new Map();

  static createAdapter(config: ModelConfig): BaseAdapter {
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter(config);
      case 'ollama':
        return new OllamaAdapter(config);
      case 'anthropic':
        return new AnthropicAdapter(config);
      case 'minimax':
        return new MinimaxAdapter(config);
      default:
        // 默认为 OpenAI 兼容接口
        return new OpenAIAdapter(config);
    }
  }

  static getOrCreateAdapter(config: ModelConfig): BaseAdapter {
    let adapter = this.instances.get(config.id);
    if (!adapter) {
      adapter = this.createAdapter(config);
      this.instances.set(config.id, adapter);
    }
    return adapter;
  }

  static removeAdapter(id: string): void {
    const adapter = this.instances.get(id);
    if (adapter) {
      // 清理适配器上的所有监听者，防止内存泄漏
      adapter.clearListeners?.();
      this.instances.delete(id);
    }
  }

  static getPresetModels(): ModelConfig[] {
    return [...presetModels];
  }

  static getEnabledAdapters(): BaseAdapter[] {
    return Array.from(this.instances.values());
  }
}

export { BaseAdapter, OpenAIAdapter, OllamaAdapter, AnthropicAdapter, MinimaxAdapter };
