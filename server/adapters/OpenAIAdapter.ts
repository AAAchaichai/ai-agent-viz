import { BaseAdapter } from './BaseAdapter.js';
import type { Message, ChatResponse, StreamChunk, ModelConfig } from '../types.ts';

export class OpenAIAdapter extends BaseAdapter {
  constructor(config: ModelConfig) {
    super(config);
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.baseUrl) {
      console.error('OpenAI Adapter: baseUrl is required');
      return false;
    }
    if (!this.config.apiKey) {
      console.error('OpenAI Adapter: apiKey is required');
      return false;
    }
    if (!this.config.model) {
      console.error('OpenAI Adapter: model is required');
      return false;
    }
    return true;
  }

  async chat(messages: Message[]): Promise<ChatResponse> {
    this.setStatus('thinking');

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 2000,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const data = await response.json();
      this.setStatus('success');

      return {
        content: data.choices[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
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
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 2000,
          stream: true
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
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6);
          if (data === '[DONE]') {
            this.setStatus('success');
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) {
              yield { content, done: false };
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
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
}
