import { create } from 'zustand';
import type { AgentState, AgentConfig } from '../types';

export interface Agent {
  id: string;
  name: string;
  position: { x: number; y: number };
  state: AgentState;
  stateStartTime: number;
  message?: string;
  color: string;
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
  
  // Actions
  addAgent: (config: Partial<AgentConfig>) => string;
  removeAgent: (id: string) => void;
  updateAgentState: (id: string, state: AgentState) => void;
  updateAgentPosition: (id: string, position: { x: number; y: number }) => void;
  updateAgentMessage: (id: string, message: string) => void;
  selectAgent: (id: string | null) => void;
  setViewport: (viewport: Partial<{ x: number; y: number; zoom: number }>) => void;
  
  // 演示模式：自动切换状态
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

  updateAgentMessage: (id, message) => {
    set((state) => ({
      agents: state.agents.map(agent => 
        agent.id === id ? { ...agent, message } : agent
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
    }, 2000); // 每2秒切换一次状态
  },

  stopDemoMode: () => {
    if (demoInterval) {
      clearInterval(demoInterval);
      demoInterval = null;
    }
  }
}));
