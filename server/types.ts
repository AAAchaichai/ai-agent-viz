// 基础类型定义
export type AgentStatus = 'idle' | 'thinking' | 'typing' | 'error' | 'success';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
}

export interface AgentInstance {
  id: string;
  name: string;
  modelConfig: ModelConfig;
  status: AgentStatus;
  currentMessage?: string;
  lastActive: number;
  conversationHistory: Message[];
}

export interface SSEEvent {
  type: 'state_change' | 'message_chunk' | 'message_complete' | 'error' | 'heartbeat';
  agentId: string;
  data: any;
  timestamp: number;
}
