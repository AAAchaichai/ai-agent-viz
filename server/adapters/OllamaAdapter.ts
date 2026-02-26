import { BaseAdapter } from './BaseAdapter.js';
import type { Message, ChatResponse, StreamChunk, ModelConfig } from '../types.ts';

export class OllamaAdapter extends BaseAdapter {
  constructor(config: ModelConfig) {
    super(config);
    // Ollama 默认本地地址
    if (!this.config.baseUrl) {
      this.config.baseUrl = 'http://localhost:11434';
    }
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.model) {
      console.error('Ollama Adapter: model is required');
      return false;
    }
    return true;
  }

  async chat(messages: Message[]): Promise<ChatResponse> {
    this.setStatus('thinking');

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: false,
          options: {
            temperature: this.config.temperature ?? 0.7,
            num_predict: this.config.maxTokens ?? 2000
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const data = await response.json();
      this.setStatus('success');

      return {
        content: data.message?.content || '',
        usage: data.eval_count ? {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        } : undefined
      };
    } catch (error) {
      this.setStatus('error');
      throw error;
    } finally {
      setTimeout(() => this.setStatus('idle'), 1000);
    }
  }

  async *streamChat(messages: Message[]): AsyncGenerator<StreamChunk, void, unknown> {
    this.setStatus('thinking');

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: true,
          options: {
            temperature: this.config.temperature ?? 0.7,
            num_predict: this.config.maxTokens ?? 2000
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      this.setStatus('typing');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content || '';
            const isDone = parsed.done || false;

            if (content) {
              yield { content, done: false };
            }

            if (isDone) {
              this.setStatus('success');
              yield { content: '', done: true };
              return;
            }
          } catch (e) {
            console.error('Failed to parse Ollama response:', e);
          }
        }
      }

      this.setStatus('success');
      yield { content: '', done: true };

    } catch (error) {
      this.setStatus('error');
      throw error;
    } finally {
      setTimeout(() => this.setStatus('idle'), 1000);
    }
  }

  // 获取本地可用模型列表
  async listModels(): Promise<Array<{ name: string; size: number }>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.models?.map((m: any) => ({
        name: m.name,
        size: m.size
      })) || [];
    } catch {
      return [];
    }
  }
}
