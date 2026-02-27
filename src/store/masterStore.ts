import { create } from 'zustand';

// 任务复杂度
export type Complexity = 'simple' | 'medium' | 'complex';

// 子任务状态
export type SubtaskStatus = 'pending' | 'running' | 'completed' | 'failed';

// 子任务
export interface Subtask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  dependencies: string[];
  requiredSkills: string[];
  status: SubtaskStatus;
  result?: string;
  assignedAgentId?: string;
  startTime?: number;
  endTime?: number;
}

// 任务分析结果
export interface TaskAnalysis {
  id: string;
  originalTask: string;
  complexity: Complexity;
  estimatedTime: number;
  reasoning: string;
  subtasks: Subtask[];
  requiredSkills: string[];
  recommendedAgents: number;
}

// 子Agent
export interface SubAgent {
  id: string;
  name: string;
  role: string;
  skills: string[];
  status: 'idle' | 'thinking' | 'typing' | 'error' | 'success';
  currentTaskId?: string;
  completedTasks: number;
}

// 任务结果
export interface TaskResult {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  summary?: string;
  subtasks: Subtask[];
  createdAt: number;
  completedAt?: number;
}

// 队列状态
export interface QueueStatus {
  queued: number;
  running: number;
  maxConcurrency: number;
}

// 总指挥状态
interface MasterState {
  // 当前分析
  currentAnalysis: TaskAnalysis | null;
  // 子Agent列表
  subAgents: SubAgent[];
  // 任务结果
  taskResults: Map<string, TaskResult>;
  // 队列状态
  queueStatus: QueueStatus;
  // 加载状态
  isAnalyzing: boolean;
  isExecuting: boolean;
  // 错误信息
  error: string | null;
}

// 总指挥Actions
interface MasterActions {
  // 设置分析结果
  setAnalysis: (analysis: TaskAnalysis | null) => void;
  // 设置子Agent
  setSubAgents: (agents: SubAgent[]) => void;
  // 更新子Agent状态
  updateSubAgentStatus: (agentId: string, status: SubAgent['status']) => void;
  // 设置任务结果
  setTaskResult: (taskId: string, result: TaskResult) => void;
  // 更新子任务状态
  updateSubtaskStatus: (taskId: string, subtaskId: string, status: SubtaskStatus, result?: string) => void;
  // 设置队列状态
  setQueueStatus: (status: QueueStatus) => void;
  // 设置加载状态
  setAnalyzing: (isAnalyzing: boolean) => void;
  setExecuting: (isExecuting: boolean) => void;
  // 设置错误
  setError: (error: string | null) => void;
  // 清除状态
  clearState: () => void;
}

// API响应类型
interface AnalyzeResponse {
  success: boolean;
  analysis: TaskAnalysis;
}

interface CreateTeamResponse {
  success: boolean;
  team: SubAgent[];
}

interface TaskStatusResponse {
  success: boolean;
  status: TaskResult;
}

const API_BASE = '/api/master';

export const useMasterStore = create<MasterState & MasterActions>((set, _get) => ({
  // 初始状态
  currentAnalysis: null,
  subAgents: [],
  taskResults: new Map(),
  queueStatus: { queued: 0, running: 0, maxConcurrency: 3 },
  isAnalyzing: false,
  isExecuting: false,
  error: null,

  // Actions
  setAnalysis: (analysis) => set({ currentAnalysis: analysis }),
  
  setSubAgents: (agents) => set({ subAgents: agents }),
  
  updateSubAgentStatus: (agentId, status) => {
    set((state) => ({
      subAgents: state.subAgents.map(agent =>
        agent.id === agentId ? { ...agent, status } : agent
      )
    }));
  },
  
  setTaskResult: (taskId, result) => {
    set((state) => {
      const newResults = new Map(state.taskResults);
      newResults.set(taskId, result);
      return { taskResults: newResults };
    });
  },
  
  updateSubtaskStatus: (taskId, subtaskId, status, result) => {
    set((state) => {
      const taskResult = state.taskResults.get(taskId);
      if (!taskResult) return state;

      const updatedSubtasks = taskResult.subtasks.map(st =>
        st.id === subtaskId ? { ...st, status, ...(result && { result }) } : st
      );

      const completed = updatedSubtasks.filter(st => st.status === 'completed').length;
      const progress = Math.round((completed / updatedSubtasks.length) * 100);

      const newResult: TaskResult = {
        ...taskResult,
        subtasks: updatedSubtasks,
        progress,
        status: progress === 100 ? 'completed' : 'running'
      };

      const newResults = new Map(state.taskResults);
      newResults.set(taskId, newResult);
      return { taskResults: newResults };
    });
  },
  
  setQueueStatus: (status) => set({ queueStatus: status }),
  
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  
  setExecuting: (isExecuting) => set({ isExecuting }),
  
  setError: (error) => set({ error }),
  
  clearState: () => set({
    currentAnalysis: null,
    subAgents: [],
    taskResults: new Map(),
    queueStatus: { queued: 0, running: 0, maxConcurrency: 3 },
    isAnalyzing: false,
    isExecuting: false,
    error: null
  })
}));

// ========== API 方法 ==========

/**
 * 分析任务
 */
export async function analyzeTask(task: string, context?: string): Promise<TaskAnalysis> {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, context })
  });

  const data: AnalyzeResponse = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error((data as any).error || '任务分析失败');
  }

  return data.analysis;
}

/**
 * 创建子Agent团队
 */
export async function createSubAgentTeam(
  analysisId: string,
  agentNames?: string[]
): Promise<SubAgent[]> {
  const response = await fetch(`${API_BASE}/create-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysisId, agentNames })
  });

  const data: CreateTeamResponse = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error((data as any).error || '创建团队失败');
  }

  return data.team;
}

/**
 * 分配并执行任务
 */
export async function assignTask(analysisId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysisId })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '任务分配失败');
  }
}

/**
 * 一站式执行任务（分析+创建团队+执行）
 */
export async function executeTask(
  task: string,
  context?: string,
  agentNames?: string[]
): Promise<{
  taskId: string;
  complexity: Complexity;
  estimatedTime: number;
  team: SubAgent[];
}> {
  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, context, agentNames })
  });

  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(data.error || '任务执行失败');
  }

  return {
    taskId: data.taskId,
    complexity: data.complexity,
    estimatedTime: data.estimatedTime,
    team: data.team
  };
}

/**
 * 获取任务状态
 */
export async function getTaskStatus(taskId: string): Promise<TaskResult> {
  const response = await fetch(`${API_BASE}/status/${taskId}`);
  const data: TaskStatusResponse = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error((data as any).error || '获取状态失败');
  }

  return data.status;
}

/**
 * 获取任务结果
 */
export async function getTaskResult(taskId: string): Promise<TaskResult> {
  const response = await fetch(`${API_BASE}/result/${taskId}`);
  const data: { success: boolean; result: TaskResult } = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error((data as any).error || '获取结果失败');
  }

  return data.result;
}

/**
 * 获取子Agent列表
 */
export async function getSubAgents(): Promise<SubAgent[]> {
  const response = await fetch(`${API_BASE}/agents`);
  const data: { success: boolean; agents: SubAgent[] } = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error((data as any).error || '获取Agent列表失败');
  }

  return data.agents;
}

/**
 * 删除子Agent
 */
export async function removeSubAgent(agentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '删除Agent失败');
  }
}

/**
 * 获取系统概览
 */
export async function getOverview(): Promise<{
  master: {
    activeAgents: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
  };
  queue: QueueStatus;
}> {
  const response = await fetch(`${API_BASE}/overview`);
  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error((data as any).error || '获取概览失败');
  }

  return data.overview;
}

/**
 * 暂停任务
 */
export async function pauseTask(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/pause/${taskId}`, {
    method: 'POST'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '暂停任务失败');
  }
}

/**
 * 取消任务
 */
export async function cancelTask(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/cancel/${taskId}`, {
    method: 'POST'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '取消任务失败');
  }
}

/**
 * 连接SSE事件流
 */
export function connectEventStream(
  onEvent: (event: any) => void,
  onError?: (error: Event) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type !== 'heartbeat') {
        onEvent(data);
      }
    } catch (e) {
      console.error('Failed to parse SSE event:', e);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    onError?.(error);
  };

  return () => {
    eventSource.close();
  };
}
