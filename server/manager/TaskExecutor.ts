import { EventEmitter } from 'events';
import { masterAgent, type SubTask, type TaskResult } from './MasterAgent.js';
import { agentManager } from './AgentManager.js';
import { taskScheduler, type SchedulerEvent } from './TaskScheduler.js';
import { MinimaxAdapter } from '../adapters/MinimaxAdapter.js';
import type { Message, ModelConfig } from '../types.js';

// 执行配置
interface ExecutorConfig {
  maxRetries: number;           // 最大重试次数
  retryDelayMs: number;         // 重试延迟
  streamUpdateInterval: number; // 流式更新间隔(ms)
  enableProgressStream: boolean; // 是否启用进度流
}

// 执行任务状态
interface ExecuteState {
  taskId: string;
  subTaskId: string;
  agentId: string;
  status: 'pending' | 'running' | 'streaming' | 'completed' | 'failed' | 'retrying';
  progress: number;            // 0-100
  currentOutput: string;       // 当前输出内容
  fullOutput: string;          // 完整输出
  startTime: number;
  endTime?: number;
  retryCount: number;
  error?: string;
}

// 执行事件
export interface ExecuteEvent {
  type: 'task_start' | 'task_progress' | 'task_stream' | 'task_complete' | 'task_failed' | 'task_retry';
  taskId: string;
  subTaskId: string;
  agentId: string;
  data: {
    progress?: number;
    output?: string;
    delta?: string;
    error?: string;
    retryCount?: number;
  };
  timestamp: number;
}

// 默认配置
const DEFAULT_CONFIG: ExecutorConfig = {
  maxRetries: 3,
  retryDelayMs: 2000,
  streamUpdateInterval: 100,
  enableProgressStream: true
};

// MiniMax 配置（用于子Agent）
const MINIMAX_CONFIG: ModelConfig = {
  id: 'minimax-subagent',
  name: 'MiniMax M2.5',
  provider: 'minimax',
  baseUrl: 'https://api.minimaxi.com/anthropic',
  model: 'MiniMax-M2.5',
  temperature: 0.7,
  maxTokens: 4000,
  enabled: true
};

export class TaskExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private executeStates: Map<string, ExecuteState> = new Map(); // key: `${taskId}-${subTaskId}`
  private adapter: MinimaxAdapter;

  constructor(config: Partial<ExecutorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adapter = new MinimaxAdapter(MINIMAX_CONFIG);

    // 监听调度器事件
    taskScheduler.on('event', this.handleSchedulerEvent.bind(this));
  }

  // ========== 核心执行方法 ==========

  /**
   * 执行任务
   * 这是主要的任务执行入口
   */
  async executeTask(taskId: string, subTaskId: string, agentId: string): Promise<string> {
    const stateKey = `${taskId}-${subTaskId}`;
    
    // 检查是否已在执行
    if (this.executeStates.has(stateKey)) {
      const existing = this.executeStates.get(stateKey)!;
      if (existing.status === 'running' || existing.status === 'streaming') {
        throw new Error(`Task ${stateKey} is already running`);
      }
    }

    // 初始化执行状态
    const state: ExecuteState = {
      taskId,
      subTaskId,
      agentId,
      status: 'pending',
      progress: 0,
      currentOutput: '',
      fullOutput: '',
      startTime: Date.now(),
      retryCount: 0
    };
    this.executeStates.set(stateKey, state);

    // 开始执行
    return this.runWithRetry(state);
  }

  /**
   * 带重试的执行逻辑
   */
  private async runWithRetry(state: ExecuteState): Promise<string> {
    const stateKey = `${state.taskId}-${state.subTaskId}`;
    
    while (state.retryCount <= this.config.maxRetries) {
      try {
        state.status = 'running';
        state.error = undefined;
        
        // 发射开始事件
        this.emitExecuteEvent('task_start', state);

        // 执行实际任务
        const result = await this.runSubtaskWithStream(state);
        
        // 标记完成
        state.status = 'completed';
        state.progress = 100;
        state.endTime = Date.now();
        state.fullOutput = result;
        
        this.emitExecuteEvent('task_complete', state);
        
        return result;

      } catch (error) {
        state.retryCount++;
        state.error = error instanceof Error ? error.message : String(error);
        
        if (state.retryCount <= this.config.maxRetries) {
          // 进入重试状态
          state.status = 'retrying';
          this.emitExecuteEvent('task_retry', state, { retryCount: state.retryCount });
          
          // 延迟后重试
          await this.delay(this.config.retryDelayMs * state.retryCount);
        } else {
          // 重试次数用尽，标记失败
          state.status = 'failed';
          state.endTime = Date.now();
          this.emitExecuteEvent('task_failed', state, { error: state.error });
          
          throw new Error(`Task execution failed after ${this.config.maxRetries} retries: ${state.error}`);
        }
      }
    }

    throw new Error('Unexpected execution path');
  }

  /**
   * 带流式响应的子任务执行
   */
  private async runSubtaskWithStream(state: ExecuteState): Promise<string> {
    const { taskId, subTaskId, agentId } = state;
    
    // 获取任务和子任务信息
    const task = masterAgent.getTaskStatus(taskId);
    const subtask = task?.subtasks.find(st => st.id === subTaskId);
    
    if (!task || !subtask) {
      throw new Error('Task or subtask not found');
    }

    // 构建任务消息
    const messages = this.buildTaskMessages(subtask, agentId);
    
    // 开始流式调用
    state.status = 'streaming';
    let fullResponse = '';
    let lastProgressUpdate = Date.now();

    try {
      // 使用 streamChat 获取流式响应
      const stream = await this.getAgentStream(agentId, messages);
      
      for await (const chunk of stream) {
        if (chunk.content) {
          fullResponse += chunk.content;
          state.currentOutput = chunk.content;
          
          // 计算进度（基于内容长度估算）
          const estimatedProgress = Math.min(90, Math.round((fullResponse.length / 2000) * 100));
          state.progress = Math.max(state.progress, estimatedProgress);
          
          // 定期发送进度更新
          const now = Date.now();
          if (now - lastProgressUpdate > this.config.streamUpdateInterval) {
            this.emitExecuteEvent('task_progress', state, {
              progress: state.progress,
              output: fullResponse,
              delta: chunk.content
            });
            lastProgressUpdate = now;
          }
          
          // 发送流式事件
          this.emitExecuteEvent('task_stream', state, {
            delta: chunk.content,
            output: fullResponse
          });
        }
        
        if (chunk.done) {
          state.progress = 100;
        }
      }

      // 最终进度更新
      this.emitExecuteEvent('task_progress', state, {
        progress: 100,
        output: fullResponse
      });

      return fullResponse;

    } catch (error) {
      // 处理流式过程中的错误
      console.error(`[TaskExecutor] Stream error for ${state.taskId}-${state.subTaskId}:`, error);
      throw error;
    }
  }

  /**
   * 获取 Agent 的流式响应
   */
  private async getAgentStream(
    agentId: string, 
    messages: Message[]
  ): Promise<AsyncGenerator<{ content: string; done: boolean }, void, unknown>> {
    // 首先尝试通过 agentManager
    const stream = await agentManager.sendMessage(agentId, messages[messages.length - 1].content);
    
    if (stream) {
      return stream;
    }

    // 备用：直接使用 adapter
    return this.adapter.streamChat(messages);
  }

  /**
   * 构建任务消息
   */
  private buildTaskMessages(subtask: SubTask, agentId: string): Message[] {
    const subAgent = masterAgent.getSubAgent(agentId);
    
    const messages: Message[] = [
      {
        role: 'system',
        content: `你是 ${subAgent?.name || 'Agent'}，负责执行总指挥分配的子任务。

任务要求：
1. 专注于当前子任务，不要偏离主题
2. 提供详细、准确的执行结果
3. 如果遇到问题，明确说明阻塞原因
4. 完成后简要总结关键成果

请开始执行任务。`
      },
      {
        role: 'user',
        content: `【子任务】${subtask.title}

描述：${subtask.description}

优先级：${subtask.priority}
预计耗时：${subtask.estimatedMinutes} 分钟

请开始执行并提供详细结果。`
      }
    ];

    return messages;
  }

  // ========== 事件处理 ==========

  /**
   * 处理调度器事件
   */
  private handleSchedulerEvent(event: SchedulerEvent): void {
    switch (event.type) {
      case 'task_started':
        // 调度器通知任务开始，我们开始实际执行
        if (event.agentId && event.subTaskId) {
          this.executeTask(event.taskId, event.subTaskId, event.agentId)
            .catch(error => {
              console.error(`[TaskExecutor] Execution error:`, error);
            });
        }
        break;
        
      case 'task_timeout':
        // 处理超时
        this.handleTimeout(event.taskId, event.subTaskId!);
        break;
    }
  }

  /**
   * 处理超时
   */
  private handleTimeout(taskId: string, subTaskId: string): void {
    const stateKey = `${taskId}-${subTaskId}`;
    const state = this.executeStates.get(stateKey);
    
    if (state) {
      state.status = 'failed';
      state.error = 'Task execution timeout';
      state.endTime = Date.now();
      
      this.emitExecuteEvent('task_failed', state, { error: 'Execution timeout' });
    }
  }

  /**
   * 发射执行事件
   */
  private emitExecuteEvent(
    type: ExecuteEvent['type'],
    state: ExecuteState,
    extraData: Partial<ExecuteEvent['data']> = {}
  ): void {
    const event: ExecuteEvent = {
      type,
      taskId: state.taskId,
      subTaskId: state.subTaskId,
      agentId: state.agentId,
      data: {
        progress: state.progress,
        output: state.fullOutput || state.currentOutput,
        ...extraData
      },
      timestamp: Date.now()
    };

    this.emit('event', event);
  }

  // ========== 公共方法 ==========

  /**
   * 获取执行状态
   */
  getExecuteState(taskId: string, subTaskId: string): ExecuteState | undefined {
    return this.executeStates.get(`${taskId}-${subTaskId}`);
  }

  /**
   * 获取所有执行状态
   */
  getAllExecuteStates(): ExecuteState[] {
    return Array.from(this.executeStates.values());
  }

  /**
   * 获取任务的执行状态
   */
  getTaskExecuteStates(taskId: string): ExecuteState[] {
    return Array.from(this.executeStates.values())
      .filter(state => state.taskId === taskId);
  }

  /**
   * 清理执行状态
   */
  clearExecuteState(taskId: string, subTaskId?: string): void {
    if (subTaskId) {
      this.executeStates.delete(`${taskId}-${subTaskId}`);
    } else {
      // 清理整个任务的所有状态
      for (const [key, state] of this.executeStates) {
        if (state.taskId === taskId) {
          this.executeStates.delete(key);
        }
      }
    }
  }

  /**
   * 强制停止任务
   */
  abortTask(taskId: string, subTaskId?: string): boolean {
    const states = subTaskId 
      ? [this.executeStates.get(`${taskId}-${subTaskId}`)].filter(Boolean) as ExecuteState[]
      : this.getTaskExecuteStates(taskId);

    let aborted = false;
    for (const state of states) {
      if (state.status === 'running' || state.status === 'streaming' || state.status === 'pending') {
        state.status = 'failed';
        state.error = 'Aborted by user';
        state.endTime = Date.now();
        aborted = true;
        
        this.emitExecuteEvent('task_failed', state, { error: 'Aborted by user' });
      }
    }

    return aborted;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExecutorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): ExecutorConfig {
    return { ...this.config };
  }

  // ========== 工具方法 ==========

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
export const taskExecutor = new TaskExecutor();
