import { create } from 'zustand';
import type { AgentState, AgentConfig, ModelConfig, AgentInstance } from '../types';
import { apiClient } from '../api/apiClient';
import { webSocketClient } from '../api/webSocketClient';

// 默认预设模型配置（离线模式使用）
const defaultPresetModels: ModelConfig[] = [
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    provider: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: false
  },
  {
    id: 'minimax',
    name: 'MiniMax M2.5',
    provider: 'minimax',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    model: 'MiniMax-M2.5',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: true
  }
];

export interface Agent {
  id: string;
  name: string;
  position: { x: number; y: number };
  state: AgentState;
  stateStartTime: number;
  message?: string;
  color: string;
  modelConfig?: ModelConfig;
  isTyping?: boolean;
}

interface AgentStore {
  // Agent 列表
  agents: Agent[];
  // 选中的 Agent
  selectedAgentId: string | null;
  // 视口设置
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  // 连接状态
  isConnected: boolean;
  // 预设模型
  presetModels: ModelConfig[];
  
  // Actions
  addAgent: (config: Partial<AgentConfig>) => string;
  addAgentFromServer: (instance: AgentInstance) => string;
  removeAgent: (id: string) => void;
  updateAgentState: (id: string, state: AgentState) => void;
  updateAgentPosition: (id: string, position: { x: number; y: number }) => void;
  updateAgentMessage: (id: string, message: string, append?: boolean) => void;
  setAgentTyping: (id: string, isTyping: boolean) => void;
  selectAgent: (id: string | null) => void;
  setViewport: (viewport: Partial<{ x: number; y: number; zoom: number }>) => void;
  setConnectionStatus: (isConnected: boolean) => void;
  setPresetModels: (models: ModelConfig[]) => void;
  
  // 服务器同步
  syncWithServer: () => Promise<void>;
  createServerAgent: (name: string, modelConfig: ModelConfig) => Promise<void>;
  deleteServerAgent: (id: string) => Promise<void>;
  sendMessageToAgent: (agentId: string, message: string) => Promise<void>;
  sendMessageBetweenAgents: (fromId: string, toId: string, message: string) => Promise<void>;
  
  // 演示模式
  startDemoMode: () => void;
  stopDemoMode: () => void;
}

// 状态对应的颜色
const stateColors: Record<AgentState, string> = {
  idle: '#888888',
  thinking: '#FFD93D',
  typing: '#6BCF7F',
  error: '#FF6B6B',
  success: '#4DABF7'
};

let agentIdCounter = 0;
let demoInterval: ReturnType<typeof setInterval> | null = null;

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  viewport: {
    x: 0,
    y: 0,
    zoom: 1
  },
  isConnected: false,
  presetModels: [],

  addAgent: (config) => {
    const id = `agent-${++agentIdCounter}`;
    const newAgent: Agent = {
      id,
      name: config.name || `Agent ${agentIdCounter}`,
      position: config.position || { 
        x: 200 + Math.random() * 400, 
        y: 150 + Math.random() * 300 
      },
      state: 'idle',
      stateStartTime: Date.now(),
      color: stateColors.idle,
      ...config
    };
    
    set((state) => ({
      agents: [...state.agents, newAgent]
    }));
    
    return id;
  },

  addAgentFromServer: (instance) => {
    const existingAgent = get().agents.find(a => a.id === instance.id);
    if (existingAgent) {
      return existingAgent.id;
    }

    const newAgent: Agent = {
      id: instance.id,
      name: instance.name,
      position: { 
        x: 200 + (get().agents.length * 150) % 600, 
        y: 150 + Math.floor(get().agents.length / 4) * 150 
      },
      state: instance.status,
      stateStartTime: Date.now(),
      color: stateColors[instance.status],
      modelConfig: instance.modelConfig,
      message: instance.currentMessage
    };
    
    set((state) => ({
      agents: [...state.agents, newAgent]
    }));
    
    return instance.id;
  },

  removeAgent: (id) => {
    set((state) => ({
      agents: state.agents.filter(a => a.id !== id),
      selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId
    }));
  },

  updateAgentState: (id, newState) => {
    set((state) => ({
      agents: state.agents.map(agent => 
        agent.id === id 
          ? { 
              ...agent, 
              state: newState, 
              stateStartTime: Date.now(),
              color: stateColors[newState]
            }
          : agent
      )
    }));
  },

  updateAgentPosition: (id, position) => {
    set((state) => ({
      agents: state.agents.map(agent => 
        agent.id === id ? { ...agent, position } : agent
      )
    }));
  },

  updateAgentMessage: (id, message, append = false) => {
    set((state) => ({
      agents: state.agents.map(agent => 
        agent.id === id 
          ? { 
              ...agent, 
              message: append ? (agent.message || '') + message : message 
            }
          : agent
      )
    }));
  },

  setAgentTyping: (id, isTyping) => {
    set((state) => ({
      agents: state.agents.map(agent => 
        agent.id === id ? { ...agent, isTyping } : agent
      )
    }));
  },

  selectAgent: (id) => {
    set({ selectedAgentId: id });
  },

  setViewport: (viewport) => {
    set((state) => ({
      viewport: { ...state.viewport, ...viewport }
    }));
  },

  setConnectionStatus: (isConnected) => {
    set({ isConnected });
  },

  setPresetModels: (models) => {
    set({ presetModels: models });
  },

  // 服务器同步
  syncWithServer: async () => {
    try {
      // 获取预设模型
      const models = await apiClient.getModels();
      get().setPresetModels(models.presets);

      // 获取已创建的 Agents
      const serverAgents = await apiClient.getAgents();
      
      // 同步到本地状态
      serverAgents.forEach((agent: AgentInstance) => {
        get().addAgentFromServer(agent);
      });
    } catch (error) {
      console.warn('Server not available, using default presets:', error);
      // 使用本地预设模型（离线模式）
      get().setPresetModels(defaultPresetModels);
    }
  },

  createServerAgent: async (name, modelConfig) => {
    try {
      const result = await apiClient.createAgent(name, modelConfig);
      if (result.success && result.agent) {
        get().addAgentFromServer(result.agent);
      }
    } catch (error) {
      console.warn('Server not available, creating local agent:', error);
      // 本地创建 Agent（离线模式）
      const localAgent: AgentInstance = {
        id: `local-${Date.now()}`,
        name,
        status: 'idle',
        modelConfig,
        currentMessage: '',
        lastActive: Date.now(),
        conversationHistory: []
      };
      get().addAgentFromServer(localAgent);
    }
  },

  deleteServerAgent: async (id) => {
    try {
      await apiClient.deleteAgent(id);
      get().removeAgent(id);
    } catch (error) {
      console.error('Failed to delete server agent:', error);
      throw error;
    }
  },

  sendMessageToAgent: async (agentId, message) => {
    const { updateAgentMessage } = get();
    
    try {
      await apiClient.sendMessage(
        agentId,
        message,
        (chunk) => {
          if (chunk.content) {
            updateAgentMessage(agentId, chunk.content, true);
          }
        },
        () => {
          // 完成
        },
        (error) => {
          console.error('Message error:', error);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  },

  sendMessageBetweenAgents: async (fromId, toId, message) => {
    const { updateAgentMessage } = get();
    
    try {
      await apiClient.sendMessageBetweenAgents(
        fromId,
        toId,
        message,
        (chunk) => {
          if (chunk.content) {
            updateAgentMessage(toId, chunk.content, true);
          }
        },
        () => {
          // 完成
        },
        (error) => {
          console.error('Message error:', error);
        }
      );
    } catch (error) {
      console.error('Failed to send message between agents:', error);
    }
  },

  // 演示模式：自动循环切换状态 idle → thinking → typing → idle
  startDemoMode: () => {
    if (demoInterval) return;
    
    const stateCycle: AgentState[] = ['idle', 'thinking', 'typing', 'idle'];
    let currentIndex = 0;
    
    demoInterval = setInterval(() => {
      const { agents } = get();
      currentIndex = (currentIndex + 1) % stateCycle.length;
      const nextState = stateCycle[currentIndex];
      
      agents.forEach(agent => {
        get().updateAgentState(agent.id, nextState);
      });
    }, 2000);
  },

  stopDemoMode: () => {
    if (demoInterval) {
      clearInterval(demoInterval);
      demoInterval = null;
    }
  }
}));

// 初始化 WebSocket 监听
export function initAgentStoreListeners() {
  const store = useAgentStore.getState();

  // 监听 WebSocket 事件
  webSocketClient.subscribe((event) => {
    switch (event.type) {
      case 'state_change':
        store.updateAgentState(event.agentId, event.data.status);
        break;
      case 'message_chunk':
        store.updateAgentMessage(event.agentId, event.data.content, true);
        break;
      case 'message_complete':
        store.setAgentTyping(event.agentId, false);
        break;
    }
  });

  // 监听连接状态
  webSocketClient.onStatusChange((status) => {
    store.setConnectionStatus(status === 'connected');
  });

  // 连接 WebSocket
  webSocketClient.connect();

  // 同步服务器数据
  store.syncWithServer();
}
