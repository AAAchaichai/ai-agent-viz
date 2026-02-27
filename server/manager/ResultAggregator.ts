import { EventEmitter } from 'events';
import { masterAgent, type SubTask, type TaskResult, type TaskAnalysis } from './MasterAgent.js';
import { MinimaxAdapter } from '../adapters/MinimaxAdapter.js';
import type { Message, ModelConfig } from '../types.js';

// 结果聚合配置
interface AggregatorConfig {
  enableAutoAggregate: boolean;    // 自动聚合
  aggregateOnComplete: boolean;    // 完成时自动聚合
  maxReportLength: number;         // 最大报告长度
  outputFormat: 'markdown' | 'html' | 'json';
  includeAgentDetails: boolean;    // 包含Agent详情
  includeTimestamps: boolean;      // 包含时间戳
  includeMetrics: boolean;         // 包含执行指标
}

// 子任务结果
interface SubTaskResult {
  subTaskId: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgentId?: string;
  agentName?: string;
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
}

// 聚合结果
export interface AggregatedResult {
  taskId: string;
  originalTask: string;
  status: 'completed' | 'partial' | 'failed';
  completedAt: number;
  summary: string;
  report: string;
  subTaskResults: SubTaskResult[];
  metrics: {
    totalSubTasks: number;
    completedSubTasks: number;
    failedSubTasks: number;
    successRate: number;
    totalDurationMs: number;
    averageSubTaskDurationMs: number;
  };
  exportData: {
    markdown: string;
    html: string;
    json: string;
  };
}

// 聚合事件
export interface AggregateEvent {
  type: 'aggregation_started' | 'aggregation_completed' | 'aggregation_failed' | 'report_generated';
  taskId: string;
  data: any;
  timestamp: number;
}

// 默认配置
const DEFAULT_CONFIG: AggregatorConfig = {
  enableAutoAggregate: true,
  aggregateOnComplete: true,
  maxReportLength: 10000,
  outputFormat: 'markdown',
  includeAgentDetails: true,
  includeTimestamps: true,
  includeMetrics: true
};

// MiniMax 配置
const MINIMAX_CONFIG: ModelConfig = {
  id: 'minimax-aggregator',
  name: 'MiniMax M2.5',
  provider: 'minimax',
  baseUrl: 'https://api.minimaxi.com/anthropic',
  model: 'MiniMax-M2.5',
  temperature: 0.5,  // 较低温度以获得更稳定的输出
  maxTokens: 8000,
  enabled: true
};

// 报告生成提示词
const REPORT_GENERATION_PROMPT = `你是专业的任务报告撰写专家。
你的职责是根据子任务的执行结果，生成一份完整、清晰、专业的任务执行报告。

报告要求：
1. 执行摘要：简要概述任务整体完成情况
2. 详细结果：按子任务列出执行结果
3. 关键成果：总结最重要的成果和发现
4. 问题与建议：列出遇到的问题和改进建议

请使用 Markdown 格式，确保结构清晰、层次分明。`;

export class ResultAggregator extends EventEmitter {
  private config: AggregatorConfig;
  private adapter: MinimaxAdapter;
  private aggregatedResults: Map<string, AggregatedResult> = new Map();

  constructor(config: Partial<AggregatorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adapter = new MinimaxAdapter(MINIMAX_CONFIG);
  }

  // ========== 核心聚合方法 ==========

  /**
   * 聚合任务结果
   */
  async aggregateResults(taskId: string, taskAnalysis?: TaskAnalysis): Promise<AggregatedResult> {
    this.emit('event', {
      type: 'aggregation_started',
      taskId,
      data: {},
      timestamp: Date.now()
    } as AggregateEvent);

    try {
      // 获取任务结果
      const taskResult = masterAgent.getTaskResult(taskId);
      if (!taskResult) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // 获取原始任务分析
      const originalTask = taskAnalysis?.originalTask || '未命名任务';

      // 收集子任务结果
      const subTaskResults = this.collectSubTaskResults(taskResult);

      // 计算指标
      const metrics = this.calculateMetrics(subTaskResults);

      // 确定整体状态
      const status = this.determineOverallStatus(subTaskResults);

      // 生成总结
      const summary = await this.generateSummary(subTaskResults, originalTask, metrics);

      // 生成详细报告
      const report = await this.generateDetailedReport(
        subTaskResults, 
        originalTask, 
        metrics,
        summary
      );

      // 生成导出格式
      const exportData = this.generateExportFormats({
        taskId,
        originalTask,
        status,
        completedAt: Date.now(),
        summary,
        report,
        subTaskResults,
        metrics
      } as AggregatedResult);

      // 构建聚合结果
      const aggregatedResult: AggregatedResult = {
        taskId,
        originalTask,
        status,
        completedAt: Date.now(),
        summary,
        report,
        subTaskResults,
        metrics,
        exportData
      };

      // 保存结果
      this.aggregatedResults.set(taskId, aggregatedResult);

      this.emit('event', {
        type: 'aggregation_completed',
        taskId,
        data: { status, metrics },
        timestamp: Date.now()
      } as AggregateEvent);

      return aggregatedResult;

    } catch (error) {
      this.emit('event', {
        type: 'aggregation_failed',
        taskId,
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now()
      } as AggregateEvent);
      
      throw error;
    }
  }

  /**
   * 收集子任务结果
   */
  private collectSubTaskResults(taskResult: TaskResult): SubTaskResult[] {
    return taskResult.subtasks.map(subtask => {
      const agent = subtask.assignedAgentId 
        ? masterAgent.getSubAgent(subtask.assignedAgentId)
        : undefined;

      return {
        subTaskId: subtask.id,
        title: subtask.title,
        description: subtask.description,
        status: subtask.status,
        assignedAgentId: subtask.assignedAgentId,
        agentName: agent?.name,
        result: subtask.result,
        durationMs: subtask.endTime && subtask.startTime 
          ? subtask.endTime - subtask.startTime 
          : undefined
      };
    });
  }

  /**
   * 计算执行指标
   */
  private calculateMetrics(subTaskResults: SubTaskResult[]): AggregatedResult['metrics'] {
    const totalSubTasks = subTaskResults.length;
    const completedSubTasks = subTaskResults.filter(st => st.status === 'completed').length;
    const failedSubTasks = subTaskResults.filter(st => st.status === 'failed').length;
    const successRate = totalSubTasks > 0 
      ? Math.round((completedSubTasks / totalSubTasks) * 100) 
      : 0;

    const durations = subTaskResults
      .map(st => st.durationMs)
      .filter((d): d is number => !!d);
    
    const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);
    const averageSubTaskDurationMs = durations.length > 0 
      ? Math.round(totalDurationMs / durations.length) 
      : 0;

    return {
      totalSubTasks,
      completedSubTasks,
      failedSubTasks,
      successRate,
      totalDurationMs,
      averageSubTaskDurationMs
    };
  }

  /**
   * 确定整体状态
   */
  private determineOverallStatus(subTaskResults: SubTaskResult[]): AggregatedResult['status'] {
    const completed = subTaskResults.filter(st => st.status === 'completed').length;
    const failed = subTaskResults.filter(st => st.status === 'failed').length;
    const total = subTaskResults.length;

    if (completed === total) return 'completed';
    if (failed === total) return 'failed';
    return 'partial';
  }

  /**
   * 生成执行总结
   */
  private async generateSummary(
    subTaskResults: SubTaskResult[],
    originalTask: string,
    metrics: AggregatedResult['metrics']
  ): Promise<string> {
    const completedResults = subTaskResults
      .filter(st => st.status === 'completed' && st.result)
      .map(st => `【${st.title}】\n${st.result?.slice(0, 500)}...`)
      .join('\n\n');

    const prompt = `任务：${originalTask}

执行概况：
- 总子任务数：${metrics.totalSubTasks}
- 完成数：${metrics.completedSubTasks}
- 失败数：${metrics.failedSubTasks}
- 成功率：${metrics.successRate}%

各子任务结果：
${completedResults}

请生成一段简洁的执行摘要（200字以内），概括任务完成情况和主要成果。`;

    try {
      const response = await this.adapter.chat([
        { role: 'system', content: REPORT_GENERATION_PROMPT },
        { role: 'user', content: prompt }
      ]);
      
      return response.content.trim();
    } catch (error) {
      console.error('[ResultAggregator] Summary generation failed:', error);
      return `任务执行${metrics.successRate >= 80 ? '成功' : '部分完成'}。完成 ${metrics.completedSubTasks}/${metrics.totalSubTasks} 个子任务。`;
    }
  }

  /**
   * 生成详细报告
   */
  private async generateDetailedReport(
    subTaskResults: SubTaskResult[],
    originalTask: string,
    metrics: AggregatedResult['metrics'],
    summary: string
  ): Promise<string> {
    const report: string[] = [];

    // 标题
    report.push(`# 任务执行报告`);
    report.push(`\n**任务名称**：${originalTask}`);
    report.push(`**生成时间**：${new Date().toLocaleString()}`);
    report.push(`**执行状态**：${this.getStatusLabel(metrics.successRate)}`);

    // 执行摘要
    report.push(`\n## 📋 执行摘要`);
    report.push(summary);

    // 执行指标
    if (this.config.includeMetrics) {
      report.push(`\n## 📊 执行指标`);
      report.push(`| 指标 | 数值 |`);
      report.push(`|------|------|`);
      report.push(`| 子任务总数 | ${metrics.totalSubTasks} |`);
      report.push(`| 已完成 | ${metrics.completedSubTasks} |`);
      report.push(`| 已失败 | ${metrics.failedSubTasks} |`);
      report.push(`| 成功率 | ${metrics.successRate}% |`);
      report.push(`| 总耗时 | ${this.formatDuration(metrics.totalDurationMs)} |`);
      report.push(`| 平均子任务耗时 | ${this.formatDuration(metrics.averageSubTaskDurationMs)} |`);
    }

    // 详细结果
    report.push(`\n## 📝 详细结果`);
    
    for (const result of subTaskResults) {
      const statusEmoji = result.status === 'completed' ? '✅' : 
                          result.status === 'failed' ? '❌' : '⏳';
      
      report.push(`\n### ${statusEmoji} ${result.title}`);
      report.push(`**描述**：${result.description}`);
      
      if (this.config.includeAgentDetails && result.agentName) {
        report.push(`**执行Agent**：${result.agentName}`);
      }
      
      if (this.config.includeTimestamps && result.durationMs) {
        report.push(`**耗时**：${this.formatDuration(result.durationMs)}`);
      }

      if (result.result) {
        report.push(`\n**执行结果**：`);
        report.push(result.result);
      }

      if (result.error) {
        report.push(`\n**错误信息**：`);
        report.push(`\`\`\`\n${result.error}\n\`\`\``);
      }
    }

    // 结论
    report.push(`\n## 🎯 结论`);
    if (metrics.successRate === 100) {
      report.push('所有子任务均已成功完成，任务执行圆满结束。');
    } else if (metrics.successRate >= 80) {
      report.push('大部分子任务已完成，建议关注未完成项并进行后续处理。');
    } else if (metrics.successRate >= 50) {
      report.push('任务部分完成，需要评估未完成项的影响并制定补救措施。');
    } else {
      report.push('任务执行遇到较多问题，建议重新评估任务方案或检查执行环境。');
    }

    return report.join('\n');
  }

  /**
   * 生成导出格式
   */
  private generateExportFormats(result: AggregatedResult): AggregatedResult['exportData'] {
    // Markdown 格式（已经是）
    const markdown = result.report;

    // HTML 格式
    const html = this.convertMarkdownToHTML(result.report);

    // JSON 格式
    const json = JSON.stringify({
      taskId: result.taskId,
      originalTask: result.originalTask,
      status: result.status,
      completedAt: result.completedAt,
      summary: result.summary,
      metrics: result.metrics,
      subTaskResults: result.subTaskResults.map(st => ({
        title: st.title,
        status: st.status,
        agentName: st.agentName,
        result: st.result,
        error: st.error,
        durationMs: st.durationMs
      }))
    }, null, 2);

    return { markdown, html, json };
  }

  /**
   * Markdown 转 HTML
   */
  private convertMarkdownToHTML(markdown: string): string {
    // 简单的 Markdown 到 HTML 转换
    let html = markdown
      .replace(/# (.*)/g, '<h1>$1</h1>')
      .replace(/## (.*)/g, '<h2>$1</h2>')
      .replace(/### (.*)/g, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\|(.*)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.length >= 2 && !cells[0].includes('-')) {
          return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>`;
        }
        return '';
      })
      .replace(/```\n([\s\S]*?)\n```/g, '<pre><code>$1</code></pre>');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>任务执行报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f5f5f5; }
    pre { background: #f8f9fa; padding: 16px; border-radius: 4px; overflow-x: auto; }
    .success { color: #28a745; }
    .partial { color: #ffc107; }
    .failed { color: #dc3545; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }

  // ========== 公共方法 ==========

  /**
   * 获取聚合结果
   */
  getAggregatedResult(taskId: string): AggregatedResult | undefined {
    return this.aggregatedResults.get(taskId);
  }

  /**
   * 获取所有聚合结果
   */
  getAllAggregatedResults(): AggregatedResult[] {
    return Array.from(this.aggregatedResults.values())
      .sort((a, b) => b.completedAt - a.completedAt);
  }

  /**
   * 导出报告
   */
  exportReport(taskId: string, format: 'markdown' | 'html' | 'json'): string | null {
    const result = this.aggregatedResults.get(taskId);
    if (!result) return null;

    return result.exportData[format];
  }

  /**
   * 清理结果
   */
  clearResult(taskId: string): boolean {
    return this.aggregatedResults.delete(taskId);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AggregatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========== 工具方法 ==========

  private getStatusLabel(successRate: number): string {
    if (successRate === 100) return '✅ 全部完成';
    if (successRate >= 80) return '🟡 大部分完成';
    if (successRate >= 50) return '🟠 部分完成';
    return '🔴 执行失败';
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

// 导出单例
export const resultAggregator = new ResultAggregator();
