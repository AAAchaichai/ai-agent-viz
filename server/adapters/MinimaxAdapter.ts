import { BaseAdapter } from './BaseAdapter.js';
import type { Message, ChatResponse, StreamChunk, ModelConfig } from '../types.js';

export class MinimaxAdapter extends BaseAdapter {
  constructor(config: ModelConfig) {
    super(config);
    this.config.baseUrl = 'https://api.minimaxi.com/anthropic';
    this.config.model = 'MiniMax-M2.5';
    // 从环境变量获取 API key
    if (!this.config.apiKey) {
      this.config.apiKey = process.env.MINIMAX_API_KEY;
    }
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      console.error('Minimax Adapter: apiKey is required');
      return false;
    }
    if (!this.config.model) {
      console.error('Minimax Adapter: model is required');
      return false;
    }
    return true;
  }

  // 转换消息格式为 Anthropic 格式
  private convertMessages(messages: Message[]): { system?: string; messages: any[] } {
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    return {
      system: systemMessage?.content,
      messages: otherMessages.map(m => ({
        role: m.role,
        content: m.content
      }))
    };
  }

  async chat(messages: Message[]): Promise<ChatResponse> {
    this.setStatus('thinking');

    try {
      const { system, messages: anthropicMessages } = this.convertMessages(messages);
      
      const body: any = {
        model: this.config.model,
        messages: anthropicMessages,
        max_tokens: this.config.maxTokens ?? 2000,
        temperature: this.config.temperature ?? 0.7
      };
      
      if (system) {
        body.system = system;
      }

      const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey!}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const data = await response.json();
      console.log('[MinimaxAdapter] Raw response:', JSON.stringify(data).slice(0, 1000));
      this.setStatus('success');

      // Handle different response formats
      let content = '';
      
      // MiniMax returns content in different formats
      if (data.content && Array.isArray(data.content)) {
        // Find the text content (MiniMax may return thinking + text)
        for (const item of data.content) {
          if (item.text) {
            content = item.text;
            break;
          }
        }
        // Fallback to thinking if no text found
        if (!content && data.content[0]?.thinking) {
          content = data.content[0].thinking;
        }
      } else if (data.text) {
        content = data.text;
      } else if (data.message?.content) {
        content = data.message.content;
      } else if (data.choices && data.choices[0]?.message?.content) {
        content = data.choices[0].message.content;
      }

      console.log('[MinimaxAdapter] Extracted content:', content.slice(0, 200));

      return {
        content: content,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
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
      const { system, messages: anthropicMessages } = this.convertMessages(messages);
      
      const body: any = {
        model: this.config.model,
        messages: anthropicMessages,
        max_tokens: this.config.maxTokens ?? 2000,
        temperature: this.config.temperature ?? 0.7,
        stream: true
      };
      
      if (system) {
        body.system = system;
      }

      const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey!}`
        },
        body: JSON.stringify(body)
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
            
            // 处理 content_block_delta 事件
            if (parsed.type === 'content_block_delta') {
              const content = parsed.delta?.text || '';
              if (content) {
                yield { content, done: false };
              }
            }
            
            // 处理 message_stop 事件
            if (parsed.type === 'message_stop') {
              this.setStatus('success');
              yield { content: '', done: true };
              return;
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
