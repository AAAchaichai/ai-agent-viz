import { create } from 'zustand';
import type { AgentState, AgentConfig, ModelConfig, AgentInstance } from '../types';
import { AgentService } from '../services/AgentService';
import { WebSocketService } from '../services/WebSocketService';

// 默认 MiniMax 模型配置（服务端获取失败时使用）
const DEFAULT_MINIMAX_CONFIG: ModelConfig = {
  id: 'minimax',
  name: 'MiniMax M2.5',
  provider: 'minimax',
  baseUrl: 'https://api.minimaxi.com/anthropic',
  model: 'MiniMax-M2.5',
  temperature: 0.7,
  maxTokens: 2000,
  enabled: true
};

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

export interface AgentStore {
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
  // 演示模式定时器（避免模块级全局变量泄漏）
  demoInterval: ReturnType<typeof setInterval> | null;
  
  // Actions - 基础状态操作
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
  
  // Actions - 业务逻辑（通过 Service 层处理）
  syncWithServer: () => Promise<void>;
  createServerAgent: (name: string, modelConfig: ModelConfig) => Promise<void>;
  deleteServerAgent: (id: string) => Promise<void>;
  sendMessageToAgent: (agentId: string, message: string) => Promise<void>;
  sendMessageBetweenAgents: (fromId: string, toId: string, message: string) => Promise<void>;
  
  // Actions - 演示模式
  startDemoMode: () => void;
  stopDemoMode: () => void;
  
  // Getters - 用于 selector 优化
  getAgentById: (id: string) => Agent | undefined;
  getAgentMessage: (id: string) => string | undefined;
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
  demoInterval: null,

  // ===== 基础状态操作（纯状态管理） =====
  
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

  /**
   * 更新 Agent 消息
   * 性能优化：使用函数式更新避免不必要的重渲染
   */
  updateAgentMessage: (id, message, append = false) => {
    set((state) => {
      const agent = state.agents.find(a => a.id === id);
      if (!agent) return state; // 无变化，不触发更新
      
      const newMessage = append ? (agent.message || '') + message : message;
      
      // 如果消息内容相同，不触发更新
      if (newMessage === agent.message) return state;
      
      return {
        agents: state.agents.map(agent => 
          agent.id === id 
            ? { ...agent, message: newMessage }
            : agent
        )
      };
    });
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

  // ===== Getters - 用于 selector 优化 =====
  
  getAgentById: (id) => {
    return get().agents.find(a => a.id === id);
  },
  
  getAgentMessage: (id) => {
    return get().agents.find(a => a.id === id)?.message;
  },

  // ===== 业务逻辑（通过 Service 层处理） =====
  
  syncWithServer: async () => {
    try {
      // 获取预设模型（统一由服务端提供）
      const models = await AgentService.fetchPresetModels();
      get().setPresetModels(models.presets);

      // 获取已创建的 Agents
      const serverAgents = await AgentService.fetchAgents();
      
      // 同步到本地状态
      serverAgents.forEach((agent: AgentInstance) => {
        get().addAgentFromServer(agent);
      });
    } catch (error) {
      console.warn('Server not available, using default MiniMax config:', error);
      // 离线模式下使用默认 MiniMax 配置，确保用户至少有一个可用模型
      get().setPresetModels([DEFAULT_MINIMAX_CONFIG]);
    }
  },

  createServerAgent: async (name, modelConfig) => {
    try {
      const result = await AgentService.createAgent(name, modelConfig);
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
      await AgentService.deleteAgent(id);
      get().removeAgent(id);
    } catch (error) {
      console.error('Failed to delete server agent:', error);
      throw error;
    }
  },

  sendMessageToAgent: async (agentId, message) => {
    const { updateAgentMessage } = get();
    
    try {
      await AgentService.sendMessage(
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
      await AgentService.sendMessageBetweenAgents(
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

  // ===== 演示模式 =====
  
  startDemoMode: () => {
    const { demoInterval } = get();
    if (demoInterval) return;
    
    const stateCycle: AgentState[] = ['idle', 'thinking', 'typing', 'idle'];
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      const { agents } = get();
      currentIndex = (currentIndex + 1) % stateCycle.length;
      const nextState = stateCycle[currentIndex];
      
      agents.forEach(agent => {
        get().updateAgentState(agent.id, nextState);
      });
    }, 2000);
    
    set({ demoInterval: interval });
  },

  stopDemoMode: () => {
    const { demoInterval } = get();
    if (demoInterval) {
      clearInterval(demoInterval);
      set({ demoInterval: null });
    }
  }
}));

/**
 * 初始化 Store 监听器
 * 使用 WebSocketService 处理 WebSocket 逻辑
 */
export function initAgentStoreListeners() {
  const store = useAgentStore.getState();
  
  // 使用 WebSocketService 管理 WebSocket 连接
  const wsService = new WebSocketService(store);
  wsService.initialize();
  
  // 同步服务器数据
  store.syncWithServer();
  
  // 返回清理函数
  return () => {
    wsService.cleanup();
  };
}
