import { webSocketClient } from '../api/webSocketClient';
import type { AgentStore } from '../store/agentStore';

/**
 * WebSocket 服务层 - 处理 WebSocket 连接和事件
 * 将 WebSocket 逻辑从 Store 中分离
 */
export class WebSocketService {
  private store: AgentStore;
  private unsubscribeCallbacks: Array<() => void> = [];

  constructor(store: AgentStore) {
    this.store = store;
  }

  /**
   * 初始化 WebSocket 监听
   */
  initialize(): void {
    // 清理之前的监听
    this.cleanup();

    // 监听 WebSocket 事件
    const unsubscribeEvent = webSocketClient.subscribe((event) => {
      switch (event.type) {
        case 'state_change':
          this.store.updateAgentState(event.agentId, event.data.status);
          break;
        case 'message_chunk':
          this.store.updateAgentMessage(event.agentId, event.data.content, true);
          break;
        case 'message_complete':
          this.store.setAgentTyping(event.agentId, false);
          break;
      }
    });
    this.unsubscribeCallbacks.push(unsubscribeEvent);

    // 监听连接状态
    const unsubscribeStatus = webSocketClient.onStatusChange((status) => {
      this.store.setConnectionStatus(status === 'connected');
    });
    this.unsubscribeCallbacks.push(unsubscribeStatus);

    // 连接 WebSocket
    webSocketClient.connect();
  }

  /**
   * 清理所有 WebSocket 监听
   */
  cleanup(): void {
    this.unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeCallbacks = [];
  }
}
