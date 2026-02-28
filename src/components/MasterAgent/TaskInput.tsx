import React, { useState, useCallback } from 'react';
import {
  useMasterStore,
  analyzeTask,
  createSubAgentTeam,
  assignTask,
  executeTask,
  type SubAgent,
  type TaskAnalysis
} from '../../store/masterStore';
import './TaskInput.css';

interface TaskInputProps {
  onAnalysisComplete: (analysis: TaskAnalysis, agents: SubAgent[]) => void;
  isAnalyzing: boolean;
  isExecuting: boolean;
}

/**
 * 清理输入文本，移除零宽字符和控制字符
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // 零宽字符
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 控制字符
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

export const TaskInput: React.FC<TaskInputProps> = ({
  onAnalysisComplete,
  isAnalyzing,
  isExecuting
}) => {
  const [task, setTask] = useState('');
  const [context, setContext] = useState('');
  const [mode, setMode] = useState<'analyze' | 'execute'>('analyze');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [agentNames, setAgentNames] = useState('');

  const {
    setAnalysis,
    setSubAgents,
    setTaskResult,
    setAnalyzing,
    setExecuting,
    setError
  } = useMasterStore();

  // 处理任务输入变化（实时清理）
  const handleTaskChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitized = sanitizeInput(e.target.value);
    setTask(sanitized);
  }, []);

  // 处理上下文输入变化（实时清理）
  const handleContextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitized = sanitizeInput(e.target.value);
    setContext(sanitized);
  }, []);

  // 处理分析
  const handleAnalyze = useCallback(async () => {
    if (!task.trim()) {
      setError('请输入任务描述');
      return;
    }

    setError(null);
    setAnalyzing(true);

    try {
      const analysis = await analyzeTask(task, context || undefined);
      setAnalysis(analysis);

      // 创建子Agent团队
      const names = agentNames
        .split(',')
        .map(n => sanitizeInput(n.trim()))
        .filter(n => n.length > 0);
      
      const team = await createSubAgentTeam(analysis.id, names.length > 0 ? names : undefined);
      setSubAgents(team);

      onAnalysisComplete(analysis, team);
    } catch (err) {
      // 详细错误处理
      let errorMessage = '分析失败';
      if (err instanceof Error) {
        errorMessage = err.message;
        // 检测特定错误模式
        if (errorMessage.includes('pattern') || errorMessage.includes('match')) {
          errorMessage = '输入包含非法字符，请检查并重新输入（避免复制粘贴的特殊格式）';
        }
      }
      setError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  }, [task, context, agentNames, setError, setAnalyzing, setAnalysis, setSubAgents, onAnalysisComplete]);

  // 处理执行
  const handleExecute = useCallback(async () => {
    if (!task.trim()) {
      setError('请输入任务描述');
      return;
    }

    setError(null);
    setExecuting(true);

    try {
      const names = agentNames
        .split(',')
        .map(n => sanitizeInput(n.trim()))
        .filter(n => n.length > 0);

      const result = await executeTask(task, context || undefined, names.length > 0 ? names : undefined);
      
      // 使用后端返回的完整分析结果
      const analysis: TaskAnalysis = {
        id: result.taskId,
        originalTask: task,
        complexity: result.complexity,
        estimatedTime: result.estimatedTime,
        reasoning: result.reasoning,
        subtasks: result.subtasks,
        requiredSkills: [], // 如果需要可以从后端返回
        recommendedAgents: result.team.length
      };

      setAnalysis(analysis);
      setSubAgents(result.team);
      
      // 初始化任务结果
      setTaskResult(result.taskId, {
        taskId: result.taskId,
        status: 'running',
        progress: 0,
        subtasks: [],
        createdAt: Date.now()
      });

      onAnalysisComplete(analysis, result.team);
    } catch (err) {
      // 详细错误处理
      let errorMessage = '执行失败';
      if (err instanceof Error) {
        errorMessage = err.message;
        // 检测特定错误模式
        if (errorMessage.includes('pattern') || errorMessage.includes('match')) {
          errorMessage = '输入包含非法字符，请检查并重新输入（避免复制粘贴的特殊格式）';
        }
      }
      setError(errorMessage);
    } finally {
      setExecuting(false);
    }
  }, [task, context, agentNames, setError, setExecuting, setAnalysis, setSubAgents, setTaskResult, onAnalysisComplete]);

  // 开始执行已分析的任务
  const handleStartExecution = useCallback(async () => {
    const { currentAnalysis } = useMasterStore.getState();
    if (!currentAnalysis) {
      setError('请先分析任务');
      return;
    }

    setExecuting(true);
    setError(null);

    try {
      await assignTask(currentAnalysis.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动执行失败');
      setExecuting(false);
    }
  }, [setError, setExecuting]);

  // 获取占位符文本
  const getPlaceholder = () => {
    return mode === 'analyze'
      ? '描述你的任务，例如：\n帮我分析这个项目的代码结构，找出潜在的性能问题...'
      : '输入要执行的任务，总指挥将自动分析并分配...';
  };

  const isLoading = isAnalyzing || isExecuting;
  const { currentAnalysis } = useMasterStore.getState();

  return (
    <div className="task-input-container">
      {/* 模式切换 */}
      <div className="mode-toggle">
        <button
          className={mode === 'analyze' ? 'active' : ''}
          onClick={() => setMode('analyze')}
          disabled={isLoading}
        >
          🔍 分析模式
        </button>
        <button
          className={mode === 'execute' ? 'active' : ''}
          onClick={() => setMode('execute')}
          disabled={isLoading}
        >
          ⚡ 执行模式
        </button>
      </div>

      {/* 任务输入 */}
      <div className="input-section">
        <label>任务描述</label>
        <textarea
          value={task}
          onChange={handleTaskChange}
          placeholder={getPlaceholder()}
          rows={5}
          disabled={isLoading}
        />
      </div>

      {/* 上下文输入 */}
      <div className="input-section">
        <div className="input-header">
          <label>上下文（可选）</label>
          <button 
            className="toggle-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '收起 ▲' : '高级 ▼'}
          </button>
        </div>
        
        {showAdvanced && (
          <>
            <textarea
              value={context}
              onChange={handleContextChange}
              placeholder="提供额外的背景信息，帮助Agent更好地理解任务..."
              rows={3}
              disabled={isLoading}
            />
            
            <div className="agent-names-input">
              <label>自定义Agent名称（可选，用逗号分隔）</label>
              <input
                type="text"
                value={agentNames}
                onChange={(e) => setAgentNames(e.target.value)}
                placeholder="例如：代码专家, 测试专家, 文档专家"
                disabled={isLoading}
              />
            </div>
          </>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="action-buttons">
        {mode === 'analyze' ? (
          <>
            <button
              className="btn-primary"
              onClick={handleAnalyze}
              disabled={isLoading || !task.trim()}
            >
              {isAnalyzing ? (
                <>🔄 分析中...</>
              ) : (
                <>🔍 分析任务</>
              )}
            </button>
            
            {currentAnalysis && (
              <button
                className="btn-secondary"
                onClick={handleStartExecution}
                disabled={isLoading}
              >
                {isExecuting ? '🔄 启动中...' : '▶️ 开始执行'}
              </button>
            )}
          </>
        ) : (
          <button
            className="btn-primary execute"
            onClick={handleExecute}
            disabled={isLoading || !task.trim()}
          >
            {isExecuting ? (
              <>🔄 执行中...</>
            ) : (
              <>⚡ 一键执行</>
            )}
          </button>
        )}
      </div>

      {/* 提示信息 */}
      <div className="tips">
        {mode === 'analyze' ? (
          <p>💡 分析模式：先分析任务复杂度，确认后再执行</p>
        ) : (
          <p>💡 执行模式：快速分析并立即执行，适合简单任务</p>
        )}
      </div>
    </div>
  );
};
