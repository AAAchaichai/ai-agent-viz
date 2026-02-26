import type { SSEEvent } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type SSEEventHandler = (event: SSEEvent) => void;

class SSEClient {
  private eventSource: EventSource | null = null;
  private listeners: Set<SSEEventHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentAgentId: string | null = null;
  private isIntentionallyClosed = false;

  // 连接到 SSE 流
  connect(agentId: string = 'all'): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.isIntentionallyClosed = false;
    this.currentAgentId = agentId;
    const url = `${API_BASE_URL}/api/stream/${agentId}`;
    
    console.log(`[SSE] Connecting to ${url}`);
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        this.notifyListeners(data);
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('[SSE] Error:', error);
      
      if (!this.isIntentionallyClosed) {
        this.attemptReconnect();
      }
    };
  }

  // 尝试重连
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.currentAgentId) {
        this.connect(this.currentAgentId);
      }
    }, delay);
  }

  // 断开连接
  disconnect(): void {
    this.isIntentionallyClosed = true;
    
    if (this.eventSource) {
      console.log('[SSE] Disconnecting');
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // 订阅事件
  subscribe(handler: SSEEventHandler): () => void {
    this.listeners.add(handler);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(handler);
    };
  }

  // 通知所有监听者
  private notifyListeners(event: SSEEvent): void {
    this.listeners.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[SSE] Listener error:', error);
      }
    });
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  // 获取当前订阅的 Agent ID
  getCurrentAgentId(): string | null {
    return this.currentAgentId;
  }
}

export const sseClient = new SSEClient();
export default SSEClient;
