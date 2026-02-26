import { useState, useEffect, useCallback, useRef } from 'react';
import { sseClient } from './sseClient';
import { webSocketClient } from './webSocketClient';
import type { AgentState, SSEEvent } from '../types';

// 使用 SSE 的 Hook
export function useAgentStatusSSE(agentId?: string) {
  const [status, setStatus] = useState<AgentState>('idle');
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const targetId = agentId || 'all';
    sseClient.connect(targetId);

    const unsubscribe = sseClient.subscribe((event) => {
      setLastEvent(event);
      
      if (event.type === 'state_change') {
        setStatus(event.data.status);
      }
    });

    // 检查连接状态
    const checkConnection = setInterval(() => {
      setIsConnected(sseClient.isConnected());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(checkConnection);
      sseClient.disconnect();
    };
  }, [agentId]);

  const reconnect = useCallback(() => {
    const targetId = agentId || 'all';
    sseClient.connect(targetId);
  }, [agentId]);

  return { status, lastEvent, isConnected, reconnect };
}

// 使用 WebSocket 的 Hook
export function useAgentStatusWS() {
  const [statuses, setStatuses] = useState<Record<string, AgentState>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  useEffect(() => {
    webSocketClient.connect();

    const unsubscribeEvents = webSocketClient.subscribe((event) => {
      if (event.type === 'state_change') {
        setStatuses(prev => ({
          ...prev,
          [event.agentId]: event.data.status
        }));
      } else if (event.type === 'message_chunk') {
        setMessages(prev => ({
          ...prev,
          [event.agentId]: (prev[event.agentId] || '') + event.data.content
        }));
      } else if (event.type === 'message_complete') {
        // 消息完成，可以在这里处理
      }
    });

    const unsubscribeStatus = webSocketClient.onStatusChange((status) => {
      setConnectionStatus(status);
      setIsConnected(status === 'connected');
    });

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
    };
  }, []);

  const reconnect = useCallback(() => {
    webSocketClient.connect();
  }, []);

  return { statuses, messages, isConnected, connectionStatus, reconnect };
}

// 综合 Hook：自动选择最佳连接方式
export function useAgentStatus(agentId?: string) {
  const ws = useAgentStatusWS();
  const sse = useAgentStatusSSE(agentId);

  // 优先使用 WebSocket，如果不支持则回退到 SSE
  if (typeof WebSocket !== 'undefined') {
    return {
      ...ws,
      mode: 'websocket' as const,
      status: agentId ? ws.statuses[agentId] || 'idle' : 'idle',
      currentMessage: agentId ? ws.messages[agentId] || '' : ''
    };
  }

  return {
    ...sse,
    mode: 'sse' as const,
    statuses: {},
    currentMessage: ''
  };
}

// 使用 Agent 消息 Hook
export function useAgentMessage(agentId: string) {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messageBuffer = useRef('');

  useEffect(() => {
    const unsubscribe = webSocketClient.subscribe((event) => {
      if (event.agentId !== agentId) return;

      if (event.type === 'message_chunk') {
        messageBuffer.current += event.data.content;
        setMessage(messageBuffer.current);
        setIsStreaming(true);
      } else if (event.type === 'message_complete') {
        setIsStreaming(false);
        messageBuffer.current = '';
      } else if (event.type === 'state_change') {
        if (event.data.status === 'typing') {
          setIsStreaming(true);
        } else if (event.data.status === 'idle') {
          setIsStreaming(false);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [agentId]);

  return { message, isStreaming };
}
