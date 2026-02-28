import { randomUUID } from 'crypto';
import { BaseAdapter } from '../adapters/BaseAdapter.js';
import { MinimaxAdapter } from '../adapters/MinimaxAdapter.js';
import type { Message, ModelConfig, AgentStatus, AgentInstance } from '../types.js';
import { agentManager } from './AgentManager.js';

// 任务分析结果
export interface TaskAnalysis {
  id: string;
  originalTask: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTime: number; // 预估时间（分钟）
  subtasks: SubTask[];
  requiredSkills: string[];
  recommendedAgents: number;
  reasoning: string;
}

// 子任务
export interface SubTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  dependencies: string[]; // 依赖的其他子任务ID
  requiredSkills: string[];
  assignedAgentId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  startTime?: number;
  endTime?: number;
}

// 子Agent信息
export interface SubAgentInfo {
  id: string;
  name: string;
  role: string;
  skills: string[];
  status: AgentStatus;
  currentTaskId?: string;
  completedTasks: number;
}

// 任务执行结果
export interface TaskResult {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  subtasks: SubTask[];
  summary?: string;
  createdAt: number;
  completedAt?: number;
}

// MiniMax 默认配置
const MINIMAX_CONFIG: ModelConfig = {
  id: 'minimax-master',
  name: 'MiniMax M2.5',
  provider: 'minimax',
  baseUrl: 'https://api.minimaxi.com/anthropic',
  model: 'MiniMax-M2.5',
  temperature: 0.7,
  maxTokens: 4000,
  enabled: true,
  apiKey: process.env.MINIMAX_API_KEY || ''
};

// 任务分析系统提示词
const TASK_ANALYSIS_PROMPT = `你是总指挥Agent，专门负责分析复杂任务并制定执行策略。

你的职责：
1. 分析用户任务的复杂度和所需技能
2. 将复杂任务分解为可并行执行的子任务
3. 评估每个子任务的优先级和预估时间
4. 推荐所需的子Agent数量和类型

分析维度：
- 复杂度评估：simple (< 2分钟), medium (2-10分钟), complex (> 10分钟)
- 任务拆分：识别可以并行执行的子任务
- 技能需求：列出完成任务所需的关键技能
- 依赖关系：识别子任务之间的依赖顺序

重要：你必须只返回 JSON 格式，不要返回任何其他文本、解释或 markdown 代码块。

输出格式（严格的 JSON）：
{
  "complexity": "simple",
  "estimatedTime": 10,
  "reasoning": "分析理由",
  "subtasks": [
    {
      "title": "子任务标题",
      "description": "详细描述",
      "priority": "high",
      "estimatedMinutes": 5,
      "dependencies": [],
      "requiredSkills": ["技能1"]
    }
  ],
  "requiredSkills": ["技能1", "技能2"],
  "recommendedAgents": 2
}`;

export class MasterAgent {
  private adapter: BaseAdapter;
  private subAgents: Map<string, SubAgentInfo> = new Map();
  private tasks: Map<string, TaskResult> = new Map();
  private taskCounter: number = 0;

  constructor() {
    console.log('[MasterAgent] Initializing with MINIMAX_CONFIG:', {
      ...MINIMAX_CONFIG,
      apiKey: MINIMAX_CONFIG.apiKey ? '***已设置***' : '***未设置***'
    });
    this.adapter = new MinimaxAdapter(MINIMAX_CONFIG);
  }

  // ========== 任务分析 ==========

  /**
   * 分析任务并生成执行计划
   */
  async analyzeTask(taskDescription: string): Promise<TaskAnalysis> {
    const analysisId = `analysis-${++this.taskCounter}`;
    
    const messages: Message[] = [
      { role: 'system', content: TASK_ANALYSIS_PROMPT },
      { role: 'user', content: `请分析以下任务：\n\n${taskDescription}` }
    ];

    try {
      const response = await this.adapter.chat(messages);
      const analysisResult = this.parseAnalysisResponse(response.content, analysisId, taskDescription);
      
      // 初始化任务结果跟踪
      this.tasks.set(analysisResult.id, {
        taskId: analysisResult.id,
        status: 'pending',
        progress: 0,
        subtasks: analysisResult.subtasks,
        createdAt: Date.now()
      });

      return analysisResult;
    } catch (error) {
      console.error('[MasterAgent] Task analysis failed:', error);
      throw new Error(`任务分析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 解析分析响应
   */
  private parseAnalysisResponse(content: string, id: string, originalTask: string): TaskAnalysis {
    try {
      // 尝试提取JSON（处理可能包含markdown代码块的情况）
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                        content.match(/\{[\s\S]*\}/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr.trim());

      // 生成子任务ID
      const subtasks: SubTask[] = (parsed.subtasks || []).map((st: any, index: number) => ({
        id: `subtask-${id}-${index}`,
        title: st.title || `子任务 ${index + 1}`,
        description: st.description || '',
        priority: st.priority || 'medium',
        estimatedMinutes: st.estimatedMinutes || 5,
        dependencies: st.dependencies || [],
        requiredSkills: st.requiredSkills || [],
        status: 'pending'
      }));

      return {
        id,
        originalTask,
        complexity: parsed.complexity || 'medium',
        estimatedTime: parsed.estimatedTime || 10,
        subtasks,
        requiredSkills: parsed.requiredSkills || [],
        recommendedAgents: parsed.recommendedAgents || Math.min(subtasks.length, 3),
        reasoning: parsed.reasoning || ''
      };
    } catch (error) {
      console.error('[MasterAgent] Failed to parse analysis:', error);
      console.error('[MasterAgent] Raw content:', content);
      // 抛出错误而不是返回默认配置，让前端知道出了问题
      throw new Error(`解析分析结果失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ========== 子Agent管理 ==========

  /**
   * 创建子Agent团队
   */
  async createSubAgentTeam(
    taskAnalysis: TaskAnalysis,
    agentNames?: string[]
  ): Promise<SubAgentInfo[]> {
    const team: SubAgentInfo[] = [];
    const count = taskAnalysis.recommendedAgents;

    for (let i = 0; i < count; i++) {
      const name = agentNames?.[i] || `${this.generateAgentName(i)}`;
      const role = this.determineRole(taskAnalysis, i);
      const skills = this.assignSkills(taskAnalysis, i);

      const subAgent: SubAgentInfo = {
        id: `subagent-${randomUUID()}`,
        name,
        role,
        skills,
        status: 'idle',
        completedTasks: 0
      };

      this.subAgents.set(subAgent.id, subAgent);
      
      // 同步创建到AgentManager
      await this.createServerAgent(subAgent);
      
      team.push(subAgent);
    }

    return team;
  }

  /**
   * 创建服务器Agent实例
   */
  private async createServerAgent(subAgent: SubAgentInfo): Promise<void> {
    try {
      // 创建系统提示词
      const systemPrompt = this.generateSystemPrompt(subAgent);
      
      await agentManager.createAgent(subAgent.name, {
        ...MINIMAX_CONFIG,
        id: subAgent.id,
        name: subAgent.name
      });

      // 设置系统提示词
      const agent = agentManager.getAgent(subAgent.id);
      if (agent) {
        agent.conversationHistory = [
          { role: 'system', content: systemPrompt }
        ];
      }

      console.log(`[MasterAgent] Created sub-agent: ${subAgent.name} (${subAgent.id})`);
    } catch (error) {
      console.error(`[MasterAgent] Failed to create server agent ${subAgent.id}:`, error);
    }
  }

  /**
   * 生成系统提示词
   */
  private generateSystemPrompt(subAgent: SubAgentInfo): string {
    return `你是${subAgent.name}，在总指挥Agent的协调下工作。

你的角色：${subAgent.role}
你的技能：${subAgent.skills.join(', ')}

工作原则：
1. 专注于分配给你的子任务
2. 完成后向总指挥汇报结果
3. 遇到阻塞问题时及时上报
4. 保持与其他Agent的协作

请高效完成分配的任务。`;
  }

  /**
   * 生成Agent名称
   */
  private generateAgentName(index: number): string {
    const names = ['海绵宝宝', '派大星', '章鱼哥', '蟹老板', '珊迪', '小蜗'];
    return names[index % names.length] + (index >= names.length ? `-${Math.floor(index / names.length) + 1}` : '');
  }

  /**
   * 确定Agent角色
   */
  private determineRole(taskAnalysis: TaskAnalysis, index: number): string {
    const roles = ['开发专家', '分析专家', '文档专家', '测试专家', '架构师'];
    if (taskAnalysis.subtasks[index]) {
      const skills = taskAnalysis.subtasks[index].requiredSkills;
      if (skills.includes('coding')) return '开发专家';
      if (skills.includes('analysis')) return '分析专家';
      if (skills.includes('documentation')) return '文档专家';
    }
    return roles[index % roles.length];
  }

  /**
   * 分配技能
   */
  private assignSkills(taskAnalysis: TaskAnalysis, index: number): string[] {
    if (taskAnalysis.subtasks[index]) {
      return taskAnalysis.subtasks[index].requiredSkills;
    }
    return taskAnalysis.requiredSkills.slice(0, 3);
  }

  /**
   * 获取所有子Agent
   */
  getAllSubAgents(): SubAgentInfo[] {
    return Array.from(this.subAgents.values());
  }

  /**
   * 获取指定子Agent
   */
  getSubAgent(id: string): SubAgentInfo | undefined {
    return this.subAgents.get(id);
  }

  /**
   * 删除子Agent
   */
  async removeSubAgent(id: string): Promise<boolean> {
    const subAgent = this.subAgents.get(id);
    if (!subAgent) return false;

    // 从AgentManager删除
    await agentManager.removeAgent(id);
    
    this.subAgents.delete(id);
    return true;
  }

  /**
   * 删除所有子Agent
   */
  async clearSubAgents(): Promise<void> {
    for (const [id] of this.subAgents) {
      await agentManager.removeAgent(id);
    }
    this.subAgents.clear();
  }

  // ========== 任务分配与跟踪 ==========

  /**
   * 分配任务给子Agent
   */
  async assignTask(taskId: string, subAgentId: string, subTaskId?: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    const subAgent = this.subAgents.get(subAgentId);

    if (!task || !subAgent) {
      return false;
    }

    // 更新子任务状态
    if (subTaskId) {
      const subtask = task.subtasks.find(st => st.id === subTaskId);
      if (subtask) {
        subtask.assignedAgentId = subAgentId;
        subtask.status = 'running';
      }
    }

    // 更新子Agent状态
    subAgent.status = 'thinking';
    subAgent.currentTaskId = subTaskId || taskId;

    // 更新任务状态
    if (task.status === 'pending') {
      task.status = 'running';
    }

    return true;
  }

  /**
   * 更新子任务结果
   */
  updateSubtaskResult(taskId: string, subTaskId: string, result: string, success: boolean = true): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const subtask = task.subtasks.find(st => st.id === subTaskId);
    if (subtask) {
      subtask.result = result;
      subtask.status = success ? 'completed' : 'failed';

      // 更新子Agent状态
      if (subtask.assignedAgentId) {
        const subAgent = this.subAgents.get(subtask.assignedAgentId);
        if (subAgent) {
          subAgent.status = success ? 'success' : 'error';
          subAgent.currentTaskId = undefined;
          if (success) {
            subAgent.completedTasks++;
          }
        }
      }
    }

    // 更新整体进度
    this.updateTaskProgress(taskId);
  }

  /**
   * 更新任务进度
   */
  private updateTaskProgress(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const completed = task.subtasks.filter(st => st.status === 'completed').length;
    const failed = task.subtasks.filter(st => st.status === 'failed').length;
    const total = task.subtasks.length;

    task.progress = Math.round((completed / total) * 100);

    // 检查是否全部完成
    if (completed + failed === total) {
      task.status = failed > 0 ? 'failed' : 'completed';
      task.completedAt = Date.now();
      
      // 生成总结
      this.generateTaskSummary(taskId);
    }
  }

  /**
   * 生成任务总结
   */
  private async generateTaskSummary(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const completedSubtasks = task.subtasks.filter(st => st.status === 'completed');
    const results = completedSubtasks.map(st => `${st.title}:\n${st.result || '无结果'}`).join('\n\n');

    const summaryPrompt = `请总结以下子任务的执行结果：\n\n${results}`;
    
    try {
      const response = await this.adapter.chat([
        { role: 'system', content: '你是任务总结专家，请简明扼要地汇总各子任务的执行结果。' },
        { role: 'user', content: summaryPrompt }
      ]);
      
      task.summary = response.content;
    } catch (error) {
      console.error('[MasterAgent] Failed to generate summary:', error);
      task.summary = '总结生成失败';
    }
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): TaskResult | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): TaskResult[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取任务结果
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.tasks.get(taskId);
  }

  // ========== 状态管理 ==========

  /**
   * 获取MasterAgent状态概览
   */
  getStatus(): {
    activeAgents: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
  } {
    const allTasks = Array.from(this.tasks.values());
    return {
      activeAgents: this.subAgents.size,
      activeTasks: allTasks.filter(t => t.status === 'running').length,
      completedTasks: allTasks.filter(t => t.status === 'completed').length,
      failedTasks: allTasks.filter(t => t.status === 'failed').length
    };
  }
}

// 导出单例
export const masterAgent = new MasterAgent();
