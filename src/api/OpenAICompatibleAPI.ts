import { AgentStateMachine } from '../engine/AgentStateMachine';
import type { 
  ChatCompletionChunk, 
  AgentState 
} from '../types';

export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class OpenAICompatibleAPI {
  private config: ModelConfig;
  private stateMachine: AgentStateMachine;
  private abortController: AbortController | null = null;
  private onStateChange: (state: AgentState) => void;

  constructor(
    config: ModelConfig,
    stateMachine: AgentStateMachine,
    onStateChange: (state: AgentState) => void
  ) {
    this.config = config;
    this.stateMachine = stateMachine;
    this.onStateChange = onStateChange;
  }

  async sendMessage(
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ) {
    // 中断之前的请求
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      // 切换到thinking状态
      this.stateMachine.transition('thinking');
      this.onStateChange('thinking');

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2000
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 切换到typing状态（开始接收流式响应）
      this.stateMachine.transition('typing');
      this.onStateChange('typing');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete();
              this.stateMachine.transition('success');
              this.onStateChange('success');
              return;
            }

            try {
              const parsed: ChatCompletionChunk = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

      onComplete();
      this.stateMachine.transition('success');
      this.onStateChange('success');

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      
      console.error('API error:', error);
      this.stateMachine.transition('error');
      this.onStateChange('error');
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.stateMachine.transition('idle');
    this.onStateChange('idle');
  }
}
