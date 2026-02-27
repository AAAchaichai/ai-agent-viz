import { EventEmitter } from 'events';
import { masterAgent, type TaskAnalysis, type SubTask, type TaskResult } from './MasterAgent.js';
import { agentManager } from './AgentManager.js';
import type { SubAgentInfo } from './MasterAgent.js';

// 任务队列项
interface QueueItem {
  taskId: string;
  subTaskId: string;
  priority: number; // 数字越小优先级越高
  agentId?: string;
  enqueueTime: number;
}

// 执行中的任务
interface RunningTask {
  taskId: string;
  subTaskId: string;
  agentId: string;
  startTime: number;
  abortController: AbortController;
}

// 调度器配置
interface SchedulerConfig {
  maxConcurrency: number;      // 最大并行数
  defaultPriority: number;     // 默认优先级
  taskTimeoutMs: number;       // 任务超时时间
  retryAttempts: number;       // 重试次数
  retryDelayMs: number;        // 重试延迟
}

// 调度器事件
export interface SchedulerEvent {
  type: 'task_queued' | 'task_started' | 'task_completed' | 'task_failed' | 'task_timeout' | 'queue_updated';
  taskId: string;
  subTaskId?: string;
  agentId?: string;
  data?: any;
  timestamp: number;
}

// 默认配置
const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrency: 3,
  defaultPriority: 5,
  taskTimeoutMs: 10 * 60 * 1000, // 10分钟
  retryAttempts: 2,
  retryDelayMs: 5000
};

export class TaskScheduler extends EventEmitter {
  private config: SchedulerConfig;
  private taskQueue: QueueItem[] = [];
  private runningTasks: Map<string, RunningTask> = new Map(); // key: `${taskId}-${subTaskId}`
  private isProcessing: boolean = false;
  private taskRetryCount: Map<string, number> = new Map();

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========== 任务队列管理 ==========

  /**
   * 提交任务到队列
   */
  async submitTask(
    taskAnalysis: TaskAnalysis,
    subAgents: SubAgentInfo[]
  ): Promise<void> {
    // 为每个子任务创建队列项
    for (const subtask of taskAnalysis.subtasks) {
      // 计算优先级（高优先级=低数字）
      const priority = this.calculatePriority(subtask);
      
      const queueItem: QueueItem = {
        taskId: taskAnalysis.id,
        subTaskId: subtask.id,
        priority,
        enqueueTime: Date.now()
      };

      // 按优先级插入队列
      this.insertByPriority(queueItem);

      // 分配Agent
      const agentId = this.findBestAgent(subtask, subAgents);
      if (agentId) {
        queueItem.agentId = agentId;
        await masterAgent.assignTask(taskAnalysis.id, agentId, subtask.id);
      }

      this.emit('event', {
        type: 'task_queued',
        taskId: taskAnalysis.id,
        subTaskId: subtask.id,
        data: { priority, agentId },
        timestamp: Date.now()
      } as SchedulerEvent);
    }

    // 触发队列处理
    this.processQueue();
  }

  /**
   * 按优先级插入队列
   */
  private insertByPriority(item: QueueItem): void {
    const index = this.taskQueue.findIndex(q => q.priority > item.priority);
    if (index === -1) {
      this.taskQueue.push(item);
    } else {
      this.taskQueue.splice(index, 0, item);
    }
  }

  /**
   * 计算子任务优先级
   */
  private calculatePriority(subtask: SubTask): number {
    let priority = this.config.defaultPriority;

    // 根据优先级标签调整
    switch (subtask.priority) {
      case 'high':
        priority -= 2;
        break;
      case 'low':
        priority += 2;
        break;
    }

    // 有依赖的任务优先级降低（因为不能立即执行）
    if (subtask.dependencies.length > 0) {
      priority += 1;
    }

    return priority;
  }

  /**
   * 查找最适合的Agent
   */
  private findBestAgent(subtask: SubTask, agents: SubAgentInfo[]): string | undefined {
    // 筛选空闲且技能匹配的Agent
    const availableAgents = agents.filter(agent => 
      agent.status === 'idle' &&
      this.hasRequiredSkills(agent, subtask.requiredSkills)
    );

    if (availableAgents.length === 0) {
      // 如果没有完全匹配的，返回第一个空闲的
      const anyIdle = agents.find(a => a.status === 'idle');
      return anyIdle?.id;
    }

    // 选择完成任务最多的Agent（负载均衡）
    return availableAgents.sort((a, b) => b.completedTasks - a.completedTasks)[0].id;
  }

  /**
   * 检查Agent是否有所需技能
   */
  private hasRequiredSkills(agent: SubAgentInfo, requiredSkills: string[]): boolean {
    if (requiredSkills.length === 0) return true;
    return requiredSkills.some(skill => 
      agent.skills.includes(skill) || agent.role.toLowerCase().includes(skill.toLowerCase())
    );
  }

  // ========== 队列处理 ==========

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.taskQueue.length > 0 && this.runningTasks.size < this.config.maxConcurrency) {
        const executableTasks = this.taskQueue.filter(item => 
          this.canExecute(item) && item.agentId
        );

        if (executableTasks.length === 0) {
          // 没有可执行的任务，等待依赖完成
          break;
        }

        // 取出最高优先级的任务
        const nextTask = executableTasks[0];
        this.taskQueue = this.taskQueue.filter(item => 
          !(item.taskId === nextTask.taskId && item.subTaskId === nextTask.subTaskId)
        );

        // 执行任务
        this.executeTask(nextTask);
      }
    } finally {
      this.isProcessing = false;
    }

    // 如果还有任务，继续处理
    if (this.taskQueue.length > 0 && this.runningTasks.size < this.config.maxConcurrency) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * 检查任务是否可以执行
   */
  private canExecute(item: QueueItem): boolean {
    const task = masterAgent.getTaskStatus(item.taskId);
    if (!task) return false;

    const subtask = task.subtasks.find(st => st.id === item.subTaskId);
    if (!subtask) return false;

    // 检查依赖是否完成
    if (subtask.dependencies.length === 0) return true;

    // 检查所有依赖的子任务是否完成
    for (const depId of subtask.dependencies) {
      const depSubtask = task.subtasks.find(st => st.id === depId || st.id.endsWith(depId));
      if (!depSubtask || depSubtask.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * 执行单个任务
   */
  private async executeTask(queueItem: QueueItem): Promise<void> {
    const { taskId, subTaskId, agentId } = queueItem;
    if (!agentId) return;

    const taskKey = `${taskId}-${subTaskId}`;
    const abortController = new AbortController();

    // 记录运行中的任务
    this.runningTasks.set(taskKey, {
      taskId,
      subTaskId,
      agentId,
      startTime: Date.now(),
      abortController
    });

    // 更新Agent状态
    const subAgent = masterAgent.getSubAgent(agentId);
    if (subAgent) {
      subAgent.status = 'thinking';
    }

    this.emit('event', {
      type: 'task_started',
      taskId,
      subTaskId,
      agentId,
      timestamp: Date.now()
    } as SchedulerEvent);

    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Task timeout'));
        }, this.config.taskTimeoutMs);
      });

      // 执行任务
      const taskPromise = this.runSubtask(taskId, subTaskId, agentId);

      // 竞争执行
      const result = await Promise.race([taskPromise, timeoutPromise]);

      // 任务完成
      this.handleTaskComplete(taskId, subTaskId, agentId, result as string);

    } catch (error) {
      this.handleTaskError(taskId, subTaskId, agentId, error);
    }
  }

  /**
   * 运行子任务
   */
  private async runSubtask(
    taskId: string,
    subTaskId: string,
    agentId: string
  ): Promise<string> {
    const task = masterAgent.getTaskStatus(taskId);
    const subtask = task?.subtasks.find(st => st.id === subTaskId);
    
    if (!task || !subtask) {
      throw new Error('Task or subtask not found');
    }

    // 构建任务描述
    const taskDescription = `[子任务] ${subtask.title}\n\n描述：${subtask.description}`;

    // 通过AgentManager发送消息
    const stream = await agentManager.sendMessage(agentId, taskDescription);
    if (!stream) {
      throw new Error('Failed to start agent stream');
    }

    // 收集响应
    let result = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        result += chunk.content;
      }
    }

    return result;
  }

  /**
   * 处理任务完成
   */
  private handleTaskComplete(
    taskId: string,
    subTaskId: string,
    agentId: string,
    result: string
  ): void {
    const taskKey = `${taskId}-${subTaskId}`;
    this.runningTasks.delete(taskKey);
    this.taskRetryCount.delete(taskKey);

    // 更新子任务结果
    masterAgent.updateSubtaskResult(taskId, subTaskId, result, true);

    // 更新Agent状态
    const subAgent = masterAgent.getSubAgent(agentId);
    if (subAgent) {
      subAgent.status = 'idle';
      subAgent.currentTaskId = undefined;
      subAgent.completedTasks++;
    }

    this.emit('event', {
      type: 'task_completed',
      taskId,
      subTaskId,
      agentId,
      data: { resultLength: result.length },
      timestamp: Date.now()
    } as SchedulerEvent);

    // 继续处理队列
    this.processQueue();
  }

  /**
   * 处理任务错误
   */
  private handleTaskError(
    taskId: string,
    subTaskId: string,
    agentId: string,
    error: any
  ): void {
    const taskKey = `${taskId}-${subTaskId}`;
    const retryCount = this.taskRetryCount.get(taskKey) || 0;

    console.error(`[TaskScheduler] Task failed: ${taskKey}`, error);

    // 检查是否需要重试
    if (retryCount < this.config.retryAttempts) {
      this.taskRetryCount.set(taskKey, retryCount + 1);
      
      // 延迟后重新入队
      setTimeout(() => {
        const task = masterAgent.getTaskStatus(taskId);
        if (task) {
          const subtask = task.subtasks.find(st => st.id === subTaskId);
          if (subtask) {
            this.insertByPriority({
              taskId,
              subTaskId,
              priority: this.calculatePriority(subtask) + retryCount,
              agentId,
              enqueueTime: Date.now()
            });
            this.runningTasks.delete(taskKey);
            this.processQueue();
          }
        }
      }, this.config.retryDelayMs);

      return;
    }

    // 重试次数用尽，标记失败
    this.runningTasks.delete(taskKey);
    this.taskRetryCount.delete(taskKey);

    // 更新子任务状态
    const errorMessage = error instanceof Error ? error.message : String(error);
    masterAgent.updateSubtaskResult(taskId, subTaskId, errorMessage, false);

    // 更新Agent状态
    const subAgent = masterAgent.getSubAgent(agentId);
    if (subAgent) {
      subAgent.status = 'error';
      subAgent.currentTaskId = undefined;
    }

    this.emit('event', {
      type: 'task_failed',
      taskId,
      subTaskId,
      agentId,
      data: { error: errorMessage },
      timestamp: Date.now()
    } as SchedulerEvent);

    // 继续处理队列
    this.processQueue();
  }

  // ========== 控制方法 ==========

  /**
   * 暂停任务
   */
  pauseTask(taskId: string): boolean {
    // 将任务从运行中移到队列前端
    for (const [key, runningTask] of this.runningTasks) {
      if (runningTask.taskId === taskId) {
        runningTask.abortController.abort();
        this.runningTasks.delete(key);

        // 重新入队
        const task = masterAgent.getTaskStatus(taskId);
        if (task) {
          const subtask = task.subtasks.find(st => st.id === runningTask.subTaskId);
          if (subtask) {
            this.insertByPriority({
              taskId,
              subTaskId: runningTask.subTaskId,
              priority: this.calculatePriority(subtask),
              agentId: runningTask.agentId,
              enqueueTime: Date.now()
            });
          }
        }
      }
    }
    return true;
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    // 中止所有相关运行中的任务
    for (const [key, runningTask] of this.runningTasks) {
      if (runningTask.taskId === taskId) {
        runningTask.abortController.abort();
        this.runningTasks.delete(key);
      }
    }

    // 从队列中移除
    this.taskQueue = this.taskQueue.filter(item => item.taskId !== taskId);

    return true;
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queued: number;
    running: number;
    maxConcurrency: number;
  } {
    return {
      queued: this.taskQueue.length,
      running: this.runningTasks.size,
      maxConcurrency: this.config.maxConcurrency
    };
  }

  /**
   * 获取队列详情
   */
  getQueueDetails(): QueueItem[] {
    return [...this.taskQueue];
  }

  /**
   * 获取运行中的任务
   */
  getRunningTasks(): RunningTask[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    // 中止所有运行中的任务
    for (const [, runningTask] of this.runningTasks) {
      runningTask.abortController.abort();
    }
    this.runningTasks.clear();
    this.taskQueue = [];
    this.taskRetryCount.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 导出单例
export const taskScheduler = new TaskScheduler();
