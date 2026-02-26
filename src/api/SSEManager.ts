import type { SSEEvent, SSEEventType, AgentState } from '../types';

export class SSEManager {
  private eventSource: EventSource | null = null;
  private listeners: Map<SSEEventType, Array<(event: SSEEvent) => void>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private url: string;

  constructor(url: string) {
    this.url = url;
    // 初始化所有事件类型的监听器数组
    const eventTypes: SSEEventType[] = ['state_change', 'message_chunk', 'message_complete', 'error', 'heartbeat'];
    eventTypes.forEach(type => this.listeners.set(type, []));
  }

  connect() {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.handleReconnect();
      };

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      this.handleReconnect();
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('error', {
        type: 'error',
        data: { message: 'Failed to establish SSE connection' },
        timestamp: Date.now()
      });
    }
  }

  private handleEvent(event: SSEEvent) {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  on(eventType: SSEEventType, callback: (event: SSEEvent) => void) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.push(callback);
    }
    
    // 返回取消订阅函数
    return () => {
      const idx = listeners?.indexOf(callback);
      if (idx !== undefined && idx > -1) {
        listeners?.splice(idx, 1);
      }
    };
  }

  private emit(eventType: SSEEventType, event: SSEEvent) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  // 模拟SSE事件（用于本地测试）
  simulateStateChange(state: AgentState) {
    this.emit('state_change', {
      type: 'state_change',
      data: { state },
      timestamp: Date.now()
    });
  }

  simulateMessageChunk(content: string) {
    this.emit('message_chunk', {
      type: 'message_chunk',
      data: { content },
      timestamp: Date.now()
    });
  }

  simulateMessageComplete() {
    this.emit('message_complete', {
      type: 'message_complete',
      data: {},
      timestamp: Date.now()
    });
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// 本地事件总线（不依赖服务器SSE）
export class LocalEventBus {
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    
    return () => this.off(event, callback);
  }

  off(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    }
  }

  emit(event: string, data?: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(cb => cb(data));
    }
  }
}
