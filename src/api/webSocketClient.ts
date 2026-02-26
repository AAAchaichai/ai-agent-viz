import type { SSEEvent } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws/agent';

export type WebSocketEventHandler = (event: SSEEvent) => void;
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<WebSocketEventHandler> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isIntentionallyClosed = false;

  // 连接到 WebSocket
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    console.log(`[WS] Connecting to ${WS_URL}`);
    this.notifyStatusChange('connecting');

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] Connection opened');
        this.reconnectAttempts = 0;
        this.notifyStatusChange('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          this.notifyListeners(data);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Connection closed');
        this.stopHeartbeat();
        this.notifyStatusChange('disconnected');
        
        if (!this.isIntentionallyClosed) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.notifyStatusChange('error');
      };

    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.notifyStatusChange('error');
      this.attemptReconnect();
    }
  }

  // 开始心跳
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000);
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 尝试重连
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // 断开连接
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      console.log('[WS] Disconnecting');
      this.ws.close();
      this.ws = null;
    }
  }

  // 发送消息
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Cannot send, connection not open');
    }
  }

  // 订阅事件
  subscribe(handler: WebSocketEventHandler): () => void {
    this.listeners.add(handler);
    
    return () => {
      this.listeners.delete(handler);
    };
  }

  // 订阅连接状态变化
  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(handler);
    
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  // 通知所有监听者
  private notifyListeners(event: SSEEvent): void {
    this.listeners.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[WS] Listener error:', error);
      }
    });
  }

  // 通知状态变化
  private notifyStatusChange(status: ConnectionStatus): void {
    this.statusListeners.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('[WS] Status listener error:', error);
      }
    });
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 获取当前状态
  getStatus(): ConnectionStatus {
    if (!this.ws) return 'disconnected';
    if (this.ws.readyState === WebSocket.OPEN) return 'connected';
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting';
    return 'disconnected';
  }
}

export const webSocketClient = new WebSocketClient();
export default WebSocketClient;
