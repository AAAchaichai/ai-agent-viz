import type { SSEEvent, SSEEventType, AgentState } from '../types';

export class SSEManager {
  private eventSource: EventSource | null = null;
  private listeners: Map<SSEEventType, Array<(event: SSEEvent) => void>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private url: string;
  private currentAgentId: string = 'all';

  constructor(url: string) {
    this.url = url;
    // 初始化所有事件类型的监听器数组
    const eventTypes: SSEEventType[] = ['state_change', 'message_chunk', 'message_complete', 'error', 'heartbeat'];
    eventTypes.forEach(type => this.listeners.set(type, []));
  }

  connect(agentId: string = 'all') {
    this.currentAgentId = agentId;
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      this.eventSource = new EventSource(`${this.url}/api/stream/${agentId}`);

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
        this.connect(this.currentAgentId);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      // 触发错误回调但不构造无效的事件对象
      const errorListeners = this.listeners.get('error');
      errorListeners?.forEach(listener => listener({
        type: 'error',
        agentId: 'system',
        data: { message: 'Failed to establish SSE connection' },
        timestamp: Date.now()
      }));
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

  // 模拟SSE事件（用于本地测试）
  simulateStateChange(state: AgentState) {
    const listeners = this.listeners.get('state_change');
    listeners?.forEach(listener => listener({
      type: 'state_change',
      agentId: 'simulated',
      data: { state },
      timestamp: Date.now()
    }));
  }

  simulateMessageChunk(content: string) {
    const listeners = this.listeners.get('message_chunk');
    listeners?.forEach(listener => listener({
      type: 'message_chunk',
      agentId: 'simulated',
      data: { content },
      timestamp: Date.now()
    }));
  }

  simulateMessageComplete() {
    const listeners = this.listeners.get('message_complete');
    listeners?.forEach(listener => listener({
      type: 'message_complete',
      agentId: 'simulated',
      data: {},
      timestamp: Date.now()
    }));
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
