import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { masterAgent, type TaskResult, type SubTask } from './MasterAgent.js';
import { taskScheduler } from './TaskScheduler.js';
import { taskExecutor } from './TaskExecutor.js';
import { collaborationManager, type CollaborationRequest } from './CollaborationManager.js';

// 异常类型
export type ExceptionType = 
  | 'task_failure'      // 任务失败
  | 'task_timeout'      // 任务超时
  | 'agent_error'       // Agent错误
  | 'dependency_fail'   // 依赖失败
  | 'resource_unavailable' // 资源不可用
  | 'validation_error'  // 验证错误
  | 'unknown';          // 未知错误

// 异常级别
export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

// 异常记录
export interface ExceptionRecord {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  taskId: string;
  subTaskId?: string;
  agentId?: string;
  message: string;
  stack?: string;
  timestamp: number;
  status: 'pending' | 'acknowledged' | 'resolving' | 'resolved' | 'escalated';
  resolution?: {
    action: string;
    resolvedBy?: string;
    resolvedAt: number;
    notes?: string;
  };
  requiresHumanIntervention: boolean;
  humanIntervention?: {
    requestedAt: number;
    respondedAt?: number;
    decision: 'retry' | 'skip' | 'abort' | 'reassign' | 'pending';
    notes?: string;
    respondedBy?: string;
  };
}

// 处理策略
export type ResolutionStrategy = 
  | 'auto_retry'      // 自动重试
  | 'manual_retry'    // 手动重试
  | 'skip'            // 跳过
  | 'reassign'        // 重新分配
  | 'escalate'        // 升级
  | 'abort'           // 中止
  | 'await_human';    // 等待人工

// 异常处理配置
interface ExceptionConfig {
  autoRetryEnabled: boolean;       // 启用自动重试
  maxAutoRetries: number;          // 最大自动重试次数
  autoRetryDelayMs: number;        // 自动重试延迟
  humanInterventionThreshold: ExceptionSeverity; // 需要人工介入的阈值
  autoEscalationEnabled: boolean;  // 自动升级
  escalationTimeoutMs: number;     // 升级超时
  pauseOnCritical: boolean;        // 关键错误时暂停
  notifyOnException: boolean;      // 异常时通知
}

// 异常事件
export interface ExceptionEvent {
  type: 'exception_occurred' | 'exception_acknowledged' | 'exception_resolved' | 'human_intervention_required' | 'human_intervention_responded';
  exceptionId: string;
  taskId: string;
  data: any;
  timestamp: number;
}

// 暂停的任务
interface PausedTask {
  taskId: string;
  pausedAt: number;
  reason: string;
  canResume: boolean;
}

// 默认配置
const DEFAULT_CONFIG: ExceptionConfig = {
  autoRetryEnabled: true,
  maxAutoRetries: 2,
  autoRetryDelayMs: 3000,
  humanInterventionThreshold: 'high',
  autoEscalationEnabled: true,
  escalationTimeoutMs: 5 * 60 * 1000, // 5分钟
  pauseOnCritical: true,
  notifyOnException: true
};

export class ExceptionHandler extends EventEmitter {
  private config: ExceptionConfig;
  private exceptions: Map<string, ExceptionRecord> = new Map();
  private pausedTasks: Map<string, PausedTask> = new Map();
  private retryCounts: Map<string, number> = new Map(); // key: taskId-subTaskId

  constructor(config: Partial<ExceptionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========== 异常记录与分类 ==========

  /**
   * 记录异常
   */
  recordException(params: {
    type: ExceptionType;
    severity: ExceptionSeverity;
    taskId: string;
    subTaskId?: string;
    agentId?: string;
    message: string;
    error?: Error;
    requiresHumanIntervention?: boolean;
  }): ExceptionRecord {
    const exception: ExceptionRecord = {
      id: `exc-${randomUUID()}`,
      type: params.type,
      severity: params.severity,
      taskId: params.taskId,
      subTaskId: params.subTaskId,
      agentId: params.agentId,
      message: params.message,
      stack: params.error?.stack,
      timestamp: Date.now(),
      status: 'pending',
      requiresHumanIntervention: params.requiresHumanIntervention ?? 
        this.shouldRequireHumanIntervention(params.severity, params.type)
    };

    this.exceptions.set(exception.id, exception);

    console.error(`[ExceptionHandler] Exception recorded:`, {
      id: exception.id,
      type: exception.type,
      severity: exception.severity,
      taskId: exception.taskId,
      message: exception.message
    });

    // 发射事件
    this.emit('event', {
      type: 'exception_occurred',
      exceptionId: exception.id,
      taskId: params.taskId,
      data: {
        type: params.type,
        severity: params.severity,
        message: params.message
      },
      timestamp: Date.now()
    } as ExceptionEvent);

    // 自动处理
    this.handleExceptionAutomatically(exception);

    return exception;
  }

  /**
   * 判断是否需要人工介入
   */
  private shouldRequireHumanIntervention(severity: ExceptionSeverity, type: ExceptionType): boolean {
    // 关键错误总是需要人工介入
    if (severity === 'critical') return true;
    
    // 根据配置阈值判断
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const thresholdLevel = severityLevels[this.config.humanInterventionThreshold];
    const currentLevel = severityLevels[severity];
    
    if (currentLevel >= thresholdLevel) return true;

    // 特定类型需要人工介入
    const humanRequiredTypes: ExceptionType[] = ['validation_error', 'resource_unavailable'];
    return humanRequiredTypes.includes(type);
  }

  /**
   * 自动处理异常
   */
  private async handleExceptionAutomatically(exception: ExceptionRecord): Promise<void> {
    // 如果需要人工介入，不自动处理
    if (exception.requiresHumanIntervention) {
      this.requestHumanIntervention(exception);
      return;
    }

    // 根据异常类型选择策略
    const strategy = this.determineStrategy(exception);
    
    switch (strategy) {
      case 'auto_retry':
        await this.handleAutoRetry(exception);
        break;
      case 'skip':
        await this.handleSkip(exception);
        break;
      case 'reassign':
        await this.handleReassign(exception);
        break;
      case 'abort':
        await this.handleAbort(exception);
        break;
      default:
        this.requestHumanIntervention(exception);
    }
  }

  /**
   * 确定处理策略
   */
  private determineStrategy(exception: ExceptionRecord): ResolutionStrategy {
    const retryKey = `${exception.taskId}-${exception.subTaskId}`;
    const retryCount = this.retryCounts.get(retryKey) || 0;

    // 检查重试次数
    if (retryCount < this.config.maxAutoRetries) {
      switch (exception.type) {
        case 'task_failure':
        case 'agent_error':
          return 'auto_retry';
        case 'task_timeout':
          return this.config.autoRetryEnabled ? 'auto_retry' : 'await_human';
      }
    }

    // 重试次数用尽后的策略
    switch (exception.severity) {
      case 'low':
        return 'skip';
      case 'medium':
        return 'reassign';
      case 'high':
      case 'critical':
        return this.config.autoEscalationEnabled ? 'escalate' : 'await_human';
    }

    return 'await_human';
  }

  // ========== 处理策略实现 ==========

  /**
   * 自动重试
   */
  private async handleAutoRetry(exception: ExceptionRecord): Promise<void> {
    const retryKey = `${exception.taskId}-${exception.subTaskId}`;
    const currentRetries = this.retryCounts.get(retryKey) || 0;
    
    this.retryCounts.set(retryKey, currentRetries + 1);
    exception.status = 'resolving';

    console.log(`[ExceptionHandler] Auto-retrying task ${retryKey} (attempt ${currentRetries + 1})`);

    // 延迟后重试
    await this.delay(this.config.autoRetryDelayMs * (currentRetries + 1));

    // 重新提交任务
    if (exception.subTaskId) {
      const task = masterAgent.getTaskStatus(exception.taskId);
      if (task) {
        taskScheduler.submitTask(
          task as any,
          masterAgent.getAllSubAgents()
        );
      }
    }

    // 标记为已解决
    this.resolveException(exception.id, 'auto_retry', 'system', `自动重试第${currentRetries + 1}次`);
  }

  /**
   * 跳过任务
   */
  private async handleSkip(exception: ExceptionRecord): Promise<void> {
    exception.status = 'resolving';
    
    console.log(`[ExceptionHandler] Skipping task ${exception.taskId}-${exception.subTaskId}`);

    // 更新子任务状态为失败但允许继续
    if (exception.subTaskId) {
      masterAgent.updateSubtaskResult(
        exception.taskId,
        exception.subTaskId,
        'Skipped due to error: ' + exception.message,
        false
      );
    }

    this.resolveException(exception.id, 'skip', 'system', '自动跳过失败的子任务');
  }

  /**
   * 重新分配
   */
  private async handleReassign(exception: ExceptionRecord): Promise<void> {
    exception.status = 'resolving';
    
    console.log(`[ExceptionHandler] Reassigning task ${exception.taskId}-${exception.subTaskId}`);

    // 找其他可用Agent
    const availableAgents = masterAgent.getAllSubAgents()
      .filter(a => a.id !== exception.agentId && a.status === 'idle');

    if (availableAgents.length > 0) {
      const newAgent = availableAgents[0];
      
      // 重新分配
      if (exception.subTaskId) {
        await masterAgent.assignTask(exception.taskId, newAgent.id, exception.subTaskId);
        
        // 重新提交
        const task = masterAgent.getTaskStatus(exception.taskId);
        if (task) {
          taskScheduler.submitTask(
            task as any,
            masterAgent.getAllSubAgents()
          );
        }
      }

      this.resolveException(exception.id, 'reassign', 'system', `重新分配给Agent: ${newAgent.name}`);
    } else {
      // 没有可用Agent，请求人工介入
      this.requestHumanIntervention(exception, '没有可用的Agent进行重新分配');
    }
  }

  /**
   * 中止任务
   */
  private async handleAbort(exception: ExceptionRecord): Promise<void> {
    exception.status = 'resolving';
    
    console.log(`[ExceptionHandler] Aborting task ${exception.taskId}`);

    // 取消调度器中的任务
    taskScheduler.cancelTask(exception.taskId);
    
    // 中止执行器中的任务
    taskExecutor.abortTask(exception.taskId);

    this.resolveException(exception.id, 'abort', 'system', '任务被中止');
  }

  // ========== 人工介入 ==========

  /**
   * 请求人工介入
   */
  private requestHumanIntervention(exception: ExceptionRecord, reason?: string): void {
    exception.status = 'pending';
    exception.requiresHumanIntervention = true;
    exception.humanIntervention = {
      requestedAt: Date.now(),
      decision: 'pending',
      notes: reason
    };

    // 如果配置了关键错误暂停，暂停整个任务
    if (this.config.pauseOnCritical && exception.severity === 'critical') {
      this.pauseTask(exception.taskId, `Critical exception: ${exception.message}`);
    }

    // 通知其他Agent
    this.notifyAgentsOfException(exception);

    this.emit('event', {
      type: 'human_intervention_required',
      exceptionId: exception.id,
      taskId: exception.taskId,
      data: {
        type: exception.type,
        severity: exception.severity,
        message: exception.message,
        reason
      },
      timestamp: Date.now()
    } as ExceptionEvent);

    console.log(`[ExceptionHandler] Human intervention requested for ${exception.id}`);
  }

  /**
   * 响应人工介入
   */
  respondToIntervention(
    exceptionId: string,
    decision: 'retry' | 'skip' | 'abort' | 'reassign',
    respondedBy: string,
    notes?: string
  ): boolean {
    const exception = this.exceptions.get(exceptionId);
    if (!exception || !exception.humanIntervention) return false;

    exception.humanIntervention.decision = decision;
    exception.humanIntervention.respondedAt = Date.now();
    exception.humanIntervention.respondedBy = respondedBy;
    exception.humanIntervention.notes = notes;
    exception.status = 'resolving';

    this.emit('event', {
      type: 'human_intervention_responded',
      exceptionId,
      taskId: exception.taskId,
      data: { decision, respondedBy, notes },
      timestamp: Date.now()
    } as ExceptionEvent);

    // 执行决策
    switch (decision) {
      case 'retry':
        this.handleManualRetry(exception);
        break;
      case 'skip':
        this.handleSkip(exception);
        break;
      case 'abort':
        this.handleAbort(exception);
        break;
      case 'reassign':
        this.handleReassign(exception);
        break;
    }

    return true;
  }

  /**
   * 手动重试
   */
  private handleManualRetry(exception: ExceptionRecord): Promise<void> {
    const retryKey = `${exception.taskId}-${exception.subTaskId}`;
    this.retryCounts.delete(retryKey); // 重置重试计数

    if (exception.subTaskId) {
      const task = masterAgent.getTaskStatus(exception.taskId);
      if (task) {
        taskScheduler.submitTask(
          task as any,
          masterAgent.getAllSubAgents()
        );
      }
    }

    this.resolveException(exception.id, 'manual_retry', exception.humanIntervention?.respondedBy, '人工触发重试');
    return Promise.resolve();
  }

  /**
   * 通知相关Agent
   */
  private notifyAgentsOfException(exception: ExceptionRecord): void {
    const otherAgents = masterAgent.getAllSubAgents()
      .filter(a => a.id !== exception.agentId)
      .slice(0, 2); // 最多通知2个Agent

    if (otherAgents.length > 0) {
      const request: CollaborationRequest = {
        fromAgentId: 'master',
        toAgentId: otherAgents[0].id,
        type: 'notification',
        content: `任务执行出现异常，需要关注：\n类型：${exception.type}\n严重程度：${exception.severity}\n消息：${exception.message}`,
        taskId: exception.taskId,
        requireResponse: false,
        metadata: { urgency: 'high' }
      };

      collaborationManager.sendMessage(request).catch(err => {
        console.error('[ExceptionHandler] Failed to notify agents:', err);
      });
    }
  }

  // ========== 任务暂停/恢复 ==========

  /**
   * 暂停任务
   */
  pauseTask(taskId: string, reason: string): boolean {
    const task = masterAgent.getTaskStatus(taskId);
    if (!task) return false;

    // 暂停调度器中的任务
    taskScheduler.pauseTask(taskId);

    // 记录暂停状态
    this.pausedTasks.set(taskId, {
      taskId,
      pausedAt: Date.now(),
      reason,
      canResume: true
    });

    console.log(`[ExceptionHandler] Task ${taskId} paused: ${reason}`);
    return true;
  }

  /**
   * 恢复任务
   */
  resumeTask(taskId: string): boolean {
    const pausedTask = this.pausedTasks.get(taskId);
    if (!pausedTask) return false;

    if (!pausedTask.canResume) {
      console.log(`[ExceptionHandler] Task ${taskId} cannot be resumed`);
      return false;
    }

    // 从暂停状态移除
    this.pausedTasks.delete(taskId);

    // 重新触发队列处理
    const task = masterAgent.getTaskStatus(taskId);
    if (task) {
      taskScheduler.submitTask(
        task as any,
        masterAgent.getAllSubAgents()
      );
    }

    console.log(`[ExceptionHandler] Task ${taskId} resumed`);
    return true;
  }

  /**
   * 获取暂停的任务
   */
  getPausedTasks(): PausedTask[] {
    return Array.from(this.pausedTasks.values());
  }

  /**
   * 检查任务是否暂停
   */
  isTaskPaused(taskId: string): boolean {
    return this.pausedTasks.has(taskId);
  }

  // ========== 异常查询与统计 ==========

  /**
   * 获取异常记录
   */
  getException(id: string): ExceptionRecord | undefined {
    return this.exceptions.get(id);
  }

  /**
   * 获取任务的所有异常
   */
  getTaskExceptions(taskId: string): ExceptionRecord[] {
    return Array.from(this.exceptions.values())
      .filter(e => e.taskId === taskId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取待处理的异常
   */
  getPendingExceptions(): ExceptionRecord[] {
    return Array.from(this.exceptions.values())
      .filter(e => e.status === 'pending' || e.status === 'acknowledged')
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  /**
   * 获取需要人工介入的异常
   */
  getRequiringHumanIntervention(): ExceptionRecord[] {
    return Array.from(this.exceptions.values())
      .filter(e => e.requiresHumanIntervention && e.status === 'pending')
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取异常统计
   */
  getExceptionStats(): {
    total: number;
    byType: Record<ExceptionType, number>;
    bySeverity: Record<ExceptionSeverity, number>;
    byStatus: Record<ExceptionRecord['status'], number>;
    requiringHumanIntervention: number;
  } {
    const stats = {
      total: this.exceptions.size,
      byType: {} as Record<ExceptionType, number>,
      bySeverity: {} as Record<ExceptionSeverity, number>,
      byStatus: {} as Record<ExceptionRecord['status'], number>,
      requiringHumanIntervention: 0
    };

    for (const exception of this.exceptions.values()) {
      stats.byType[exception.type] = (stats.byType[exception.type] || 0) + 1;
      stats.bySeverity[exception.severity] = (stats.bySeverity[exception.severity] || 0) + 1;
      stats.byStatus[exception.status] = (stats.byStatus[exception.status] || 0) + 1;
      if (exception.requiresHumanIntervention) {
        stats.requiringHumanIntervention++;
      }
    }

    return stats;
  }

  /**
   * 确认异常
   */
  acknowledgeException(exceptionId: string, acknowledgedBy: string): boolean {
    const exception = this.exceptions.get(exceptionId);
    if (!exception || exception.status !== 'pending') return false;

    exception.status = 'acknowledged';
    
    this.emit('event', {
      type: 'exception_acknowledged',
      exceptionId,
      taskId: exception.taskId,
      data: { acknowledgedBy },
      timestamp: Date.now()
    } as ExceptionEvent);

    return true;
  }

  /**
   * 解决异常
   */
  resolveException(
    exceptionId: string, 
    action: string, 
    resolvedBy?: string, 
    notes?: string
  ): boolean {
    const exception = this.exceptions.get(exceptionId);
    if (!exception) return false;

    exception.status = 'resolved';
    exception.resolution = {
      action,
      resolvedBy,
      resolvedAt: Date.now(),
      notes
    };

    this.emit('event', {
      type: 'exception_resolved',
      exceptionId,
      taskId: exception.taskId,
      data: { action, resolvedBy, notes },
      timestamp: Date.now()
    } as ExceptionEvent);

    return true;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExceptionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========== 工具方法 ==========

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
export const exceptionHandler = new ExceptionHandler();
