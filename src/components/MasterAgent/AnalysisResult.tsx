import React, { useState } from 'react';
import type { TaskAnalysis, TaskResult } from '../../store/masterStore';
import './AnalysisResult.css';

interface AnalysisResultProps {
  analysis: TaskAnalysis;
  taskResult: TaskResult | null;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  analysis,
  taskResult
}) => {
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'analysis' | 'progress'>(
    taskResult ? 'progress' : 'analysis'
  );

  // 切换子任务展开状态
  const toggleSubtask = (subtaskId: string) => {
    const newExpanded = new Set(expandedSubtasks);
    if (newExpanded.has(subtaskId)) {
      newExpanded.delete(subtaskId);
    } else {
      newExpanded.add(subtaskId);
    }
    setExpandedSubtasks(newExpanded);
  };

  // 获取复杂度颜色
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple':
        return { bg: 'rgba(74, 222, 128, 0.2)', text: '#4ade80', border: 'rgba(74, 222, 128, 0.3)' };
      case 'medium':
        return { bg: 'rgba(251, 191, 36, 0.2)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' };
      case 'complex':
        return { bg: 'rgba(248, 113, 113, 0.2)', text: '#f87171', border: 'rgba(248, 113, 113, 0.3)' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.2)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)' };
    }
  };

  // 获取子任务状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: '✅', color: '#4ade80' };
      case 'running':
        return { icon: '🔄', color: '#60a5fa' };
      case 'failed':
        return { icon: '❌', color: '#f87171' };
      default:
        return { icon: '⏳', color: '#94a3b8' };
    }
  };

  // 格式化时间
  const formatTime = (minutes: number) => {
    if (minutes < 1) return `${Math.round(minutes * 60)}秒`;
    if (minutes < 60) return `${Math.round(minutes)}分钟`;
    return `${Math.round(minutes / 60)}小时`;
  };

  const complexityStyle = getComplexityColor(analysis.complexity);
  const progress = taskResult?.progress || 0;
  const status = taskResult?.status || 'pending';

  return (
    <div className="analysis-result">
      {/* 标签页切换 */}
      <div className="result-tabs">
        <button
          className={activeTab === 'analysis' ? 'active' : ''}
          onClick={() => setActiveTab('analysis')}
        >
          📊 分析结果
        </button>
        <button
          className={activeTab === 'progress' ? 'active' : ''}
          onClick={() => setActiveTab('progress')}
        >
          📈 执行进度
          {taskResult && taskResult.status === 'running' && (
            <span className="pulse-indicator">●</span>
          )}
        </button>
      </div>

      {activeTab === 'analysis' ? (
        <>
          {/* 任务概览 */}
          <div className="analysis-header">
            <div className="complexity-badge"
              style={{
                backgroundColor: complexityStyle.bg,
                color: complexityStyle.text,
                borderColor: complexityStyle.border
              }}
            >
              {analysis.complexity === 'simple' && '简单任务'}
              {analysis.complexity === 'medium' && '中等任务'}
              {analysis.complexity === 'complex' && '复杂任务'}
            </div>
            
            <div className="time-estimate">
              ⏱️ 预计 {formatTime(analysis.estimatedTime)}
            </div>
          </div>

          {/* 分析理由 */}
          {analysis.reasoning && (
            <div className="reasoning-section">
              <h4>💡 分析理由</h4>
              <p>{analysis.reasoning}</p>
            </div>
          )}

          {/* 技能需求 */}
          {analysis.requiredSkills.length > 0 && (
            <div className="skills-section">
              <h4>🛠️ 所需技能</h4>
              <div className="skills-list">
                {analysis.requiredSkills.map((skill, idx) => (
                  <span key={idx} className="skill-badge">{skill}</span>
                ))}
              </div>
            </div>
          )}

          {/* 推荐配置 */}
          <div className="recommendation-section">
            <div className="recommendation-item">
              <span className="label">推荐Agent数</span>
              <span className="value">{analysis.recommendedAgents} 个</span>
            </div>
            <div className="recommendation-item">
              <span className="label">子任务数</span>
              <span className="value">{analysis.subtasks.length} 个</span>
            </div>
          </div>

          {/* 子任务列表 */}
          {analysis.subtasks.length > 0 && (
            <div className="subtasks-section">
              <h4>📋 子任务分解</h4>
              <div className="subtasks-list">
                {analysis.subtasks.map((subtask, index) => {
                  const resultSubtask = taskResult?.subtasks.find(
                    st => st.id === subtask.id
                  );
                  const currentStatus = resultSubtask?.status || subtask.status;
                  const statusStyle = getStatusStyle(currentStatus);
                  const isExpanded = expandedSubtasks.has(subtask.id);
                  
                  return (
                    <div
                      key={subtask.id}
                      className={`subtask-item ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleSubtask(subtask.id)}
                    >
                      <div className="subtask-header">
                        <span className="subtask-index">{index + 1}</span>
                        <span className="subtask-status" style={{ color: statusStyle.color }}>
                          {statusStyle.icon}
                        </span>
                        <span className="subtask-title">{subtask.title}</span>
                        <span className="subtask-priority"
                          style={{
                            color: subtask.priority === 'high' ? '#f87171' : 
                                   subtask.priority === 'medium' ? '#fbbf24' : '#4ade80'
                          }}
                        >
                          {subtask.priority === 'high' && '高'}
                          {subtask.priority === 'medium' && '中'}
                          {subtask.priority === 'low' && '低'}
                        </span>
                        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                          ▶
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div className="subtask-details">
                          <p>{subtask.description}</p>
                          <div className="subtask-meta">
                            <span>⏱️ 预计 {formatTime(subtask.estimatedMinutes)}</span>
                            {subtask.dependencies.length > 0 && (
                              <span>🔗 依赖: {subtask.dependencies.join(', ')}</span>
                            )}
                          </div>                          
                          {resultSubtask?.result && (
                            <div className="subtask-result">
                              <h5>执行结果</h5>
                              <pre>{resultSubtask.result}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 执行进度 */}
          <div className="progress-section">
            <div className="progress-header">
              <span className="progress-label">总体进度</span>
              <span className="progress-value" style={{ color: status === 'failed' ? '#f87171' : '#4ade80' }}>
                {progress}%
              </span>
            </div>
            
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{
                  width: `${progress}%`,
                  backgroundColor: status === 'failed' ? '#f87171' : '#4ade80'
                }}
              />
            </div>
            
            <div className="progress-status">
              {status === 'pending' && '⏳ 等待执行...'}
              {status === 'running' && '🔄 执行中...'}
              {status === 'completed' && '✅ 已完成'}
              {status === 'failed' && '❌ 执行失败'}
            </div>
          </div>

          {/* 子任务进度 */}
          {taskResult?.subtasks && taskResult.subtasks.length > 0 && (
            <div className="subtasks-progress">
              <h4>子任务进度</h4>
              <div className="subtasks-status-list">
                {taskResult.subtasks.map((subtask, index) => {
                  const statusStyle = getStatusStyle(subtask.status);
                  return (
                    <div key={subtask.id} className="subtask-progress-item">
                      <span className="subtask-num">{index + 1}</span>
                      <span className="subtask-name">{subtask.title}</span>
                      <span className="subtask-state" style={{ color: statusStyle.color }}>
                        {statusStyle.icon} {subtask.assignedAgentId ? `(${subtask.assignedAgentId.slice(0, 8)}...)` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 任务总结 */}
          {taskResult?.summary && (
            <div className="summary-section">
              <h4>📝 执行总结</h4>
              <div className="summary-content">
                <pre>{taskResult.summary}</pre>
              </div>
            </div>
          )}

          {/* 时间信息 */}
          {taskResult?.createdAt && (
            <div className="time-info">
              <span>开始: {new Date(taskResult.createdAt).toLocaleString()}</span>
              {taskResult.completedAt && (
                <span>完成: {new Date(taskResult.completedAt).toLocaleString()}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
