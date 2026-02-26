// Agent状态类型
export type AgentState = 'idle' | 'typing' | 'thinking' | 'error' | 'success';

// 动画帧定义
export interface AnimationFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  duration: number; // 毫秒
}

// 精灵配置
export interface SpriteConfig {
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, AnimationFrame[]>;
}

// Agent配置
export interface AgentConfig {
  id: string;
  name: string;
  spriteUrl?: string;
  spriteConfig?: SpriteConfig;
  position: { x: number; y: number };
}

// 消息类型
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// SSE事件类型
export type SSEEventType = 
  | 'state_change' 
  | 'message_chunk' 
  | 'message_complete' 
  | 'error'
  | 'heartbeat';

export interface SSEEvent {
  type: SSEEventType;
  agentId: string;
  data: any;
  timestamp: number;
}

// 模型配置
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

// Agent实例（服务端）
export interface AgentInstance {
  id: string;
  name: string;
  modelConfig: ModelConfig;
  status: AgentState;
  currentMessage?: string;
  lastActive: number;
  conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

// 游戏循环回调
export interface GameLoopCallbacks {
  onUpdate: (deltaTime: number) => void;
  onRender: () => void;
}

// OpenAI兼容接口类型
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}
