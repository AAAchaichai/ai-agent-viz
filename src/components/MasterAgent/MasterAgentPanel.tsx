import React, { useEffect, useState } from 'react';
import { useMasterStore, connectEventStream, getOverview, type SubAgent, type TaskAnalysis } from '../../store/masterStore';
import { TaskInput } from './TaskInput';
import { AnalysisResult } from './AnalysisResult';
import './MasterAgentPanel.css';

export const MasterAgentPanel: React.FC = () => {
  const {
    currentAnalysis,
    subAgents,
    taskResults,
    queueStatus,
    isAnalyzing,
    isExecuting,
    error,
    setSubAgents,
    setQueueStatus,
    updateSubAgentStatus,
    updateSubtaskStatus,
    setError
  } = useMasterStore();

  const [overview, setOverview] = useState({
    activeAgents: 0,
    activeTasks: 0,
    completedTasks: 0,
    failedTasks: 0
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 连接SSE事件流
  useEffect(() => {
    const disconnect = connectEventStream(
      (event) => {
        handleSchedulerEvent(event);
      },
      (error) => {
        console.error('SSE error:', error);
      }
    );

    // 定时刷新概览
    const interval = setInterval(refreshOverview, 5000);
    refreshOverview();

    return () => {
      disconnect();
      clearInterval(interval);
    };
  }, []);

  // 处理调度器事件
  const handleSchedulerEvent = (event: any) => {
    if (event.type === 'scheduler') {
      const { event: schedulerEvent } = event;

      switch (schedulerEvent.type) {
        case 'task_started':
          if (schedulerEvent.agentId) {
            updateSubAgentStatus(schedulerEvent.agentId, 'thinking');
          }
          break;
        case 'task_completed':
          if (schedulerEvent.agentId) {
            updateSubAgentStatus(schedulerEvent.agentId, 'success');
            setTimeout(() => {
              updateSubAgentStatus(schedulerEvent.agentId!, 'idle');
            }, 2000);
          }
          if (schedulerEvent.taskId && schedulerEvent.subTaskId) {
            updateSubtaskStatus(
              schedulerEvent.taskId,
              schedulerEvent.subTaskId,
              'completed',
              schedulerEvent.data?.resultLength
            );
          }
          break;
        case 'task_failed':
          if (schedulerEvent.agentId) {
            updateSubAgentStatus(schedulerEvent.agentId, 'error');
          }
          if (schedulerEvent.taskId && schedulerEvent.subTaskId) {
            updateSubtaskStatus(
              schedulerEvent.taskId,
              schedulerEvent.subTaskId,
              'failed',
              schedulerEvent.data?.error
            );
          }
          break;
        case 'queue_updated':
          if (schedulerEvent.data?.queueStatus) {
            setQueueStatus(schedulerEvent.data.queueStatus);
          }
          break;
      }
    }
  };

  // 刷新概览
  const refreshOverview = async () => {
    try {
      const data = await getOverview();
      setOverview(data.master);
      setQueueStatus(data.queue);
    } catch (err) {
      // 静默失败
    }
  };

  // 处理分析完成
  const handleAnalysisComplete = (_analysis: TaskAnalysis, agents: SubAgent[]) => {
    setSubAgents(agents);
  };

  // 获取当前选中的任务结果
  const currentTaskResult = selectedTaskId
    ? taskResults.get(selectedTaskId) ?? null
    : null;

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return '#6b7280';
      case 'thinking': return '#fbbf24';
      case 'typing': return '#60a5fa';
      case 'error': return '#f87171';
      case 'success': return '#4ade80';
      default: return '#6b7280';
    }
  };

  return (
    <div className="master-panel">
      {/* 头部 */}
      <div className="master-header">
        <h2>🎯 总指挥系统</h2>
        <div className="master-stats">
          <div className="stat-item">
            <span className="stat-label">活跃Agent</span>
            <span className="stat-value">{overview.activeAgents}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">运行中</span>
            <span className="stat-value">{queueStatus.running}/{queueStatus.maxConcurrency}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">队列</span>
            <span className="stat-value">{queueStatus.queued}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">已完成</span>
            <span className="stat-value success">{overview.completedTasks}</span>
          </div>
          {overview.failedTasks > 0 && (
            <div className="stat-item">
              <span className="stat-label">失败</span>
              <span className="stat-value error">{overview.failedTasks}</span>
            </div>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="master-error">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* 主内容区 */}
      <div className="master-content">
        {/* 左侧：任务输入和分析结果 */}
        <div className="master-left">
          <TaskInput
            onAnalysisComplete={handleAnalysisComplete}
            isAnalyzing={isAnalyzing}
            isExecuting={isExecuting}
          />

          {currentAnalysis && (
            <AnalysisResult
              analysis={currentAnalysis}
              taskResult={currentTaskResult}
            />
          )}
        </div>

        {/* 右侧：子Agent列表 */}
        <div className="master-right">
          <div className="agents-section">
            <h3>🤖 子Agent团队</h3>

            {subAgents.length === 0 ? (
              <div className="agents-empty">
                <p>暂无子Agent</p>
                <p className="hint">分析任务后将自动创建团队</p>
              </div>
            ) : (
              <div className="agents-list">
                {subAgents.map(agent => (
                  <div key={agent.id} className="agent-card">
                    <div
                      className="agent-status-indicator"
                      style={{ backgroundColor: getStatusColor(agent.status) }}
                    />
                    <div className="agent-info">
                      <div className="agent-name">{agent.name}</div>
                      <div className="agent-role">{agent.role}</div>
                      <div className="agent-skills">
                        {agent.skills.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="skill-tag">{skill}</span>
                        ))}
                      </div>
                    </div>
                    <div className="agent-stats">
                      <span className="completed-count">
                        ✓ {agent.completedTasks}
                      </span>
                      <span
                        className="status-badge"
                        style={{ color: getStatusColor(agent.status) }}
                      >
                        {agent.status === 'idle' && '空闲'}
                        {agent.status === 'thinking' && '思考中'}
                        {agent.status === 'typing' && '执行中'}
                        {agent.status === 'error' && '错误'}
                        {agent.status === 'success' && '完成'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 任务历史 */}
          {taskResults.size > 0 && (
            <div className="tasks-section">
              <h3>📋 任务历史</h3>
              <div className="tasks-list">
                {Array.from(taskResults.entries()).map(([taskId, result]) => (
                  <div
                    key={taskId}
                    className={`task-item ${selectedTaskId === taskId ? 'selected' : ''}`}
                    onClick={() => setSelectedTaskId(taskId)}
                  >
                    <div className="task-id">{taskId.slice(0, 20)}...</div>
                    <div className="task-progress">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${result.progress}%`,
                          backgroundColor: result.status === 'failed' ? '#f87171' : '#4ade80'
                        }}
                      />
                      <span>{result.progress}%</span>
                    </div>
                    <span className={`task-status status-${result.status}`}>
                      {result.status === 'pending' && '⏳'}
                      {result.status === 'running' && '🔄'}
                      {result.status === 'completed' && '✅'}
                      {result.status === 'failed' && '❌'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
