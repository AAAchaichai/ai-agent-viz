import React from 'react';
import type { Subtask } from '../../store/masterStore';
import './ProgressTimeline.css';

interface ProgressTimelineProps {
  subtasks: Subtask[];
  startTime?: number;
  currentTime?: number;
}

interface TimelineEvent {
  id: string;
  title: string;
  status: Subtask['status'];
  timestamp: number;
  duration?: number;
  agentName?: string;
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ 
  subtasks, 
  startTime = Date.now(),
  currentTime = Date.now()
}) => {
  void currentTime; // 标记为有意使用
  // 构建时间线事件
  // 构建时间线事件
  const events: TimelineEvent[] = subtasks.map(subtask => ({
    id: subtask.id,
    title: subtask.title,
    status: subtask.status,
    timestamp: startTime, // 简化：使用开始时间
    duration: subtask.startTime && subtask.endTime 
      ? subtask.endTime - subtask.startTime 
      : undefined,
    agentName: subtask.assignedAgentId
  }));

  // 计算总体进度
  const completedCount = subtasks.filter(st => st.status === 'completed').length;
  const failedCount = subtasks.filter(st => st.status === 'failed').length;
  const runningCount = subtasks.filter(st => st.status === 'running').length;
  const totalProgress = subtasks.length > 0 
    ? Math.round((completedCount / subtasks.length) * 100) 
    : 0;

  // 获取状态配置
  const getStatusConfig = (status: Subtask['status']) => {
    switch (status) {
      case 'completed':
        return { color: '#4ade80', icon: '✓', label: '完成' };
      case 'failed':
        return { color: '#f87171', icon: '✕', label: '失败' };
      case 'running':
        return { color: '#60a5fa', icon: '◐', label: '进行中' };
      default:
        return { color: '#9ca3af', icon: '○', label: '待处理' };
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '--';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="progress-timeline">
      <div className="timeline-header">
        <div className="header-left">
          <span className="timeline-title">📊 进度时间线</span>
          <div className="timeline-stats">
            <span className="stat completed">{completedCount} 完成</span>
            <span className="stat running">{runningCount} 进行中</span>
            <span className="stat failed">{failedCount} 失败</span>
            <span className="stat total">{subtasks.length} 总计</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="progress-ring">
            <svg viewBox="0 0 36 36" className="circular-chart">
              <path
                className="circle-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="circle"
                strokeDasharray={`${totalProgress}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                style={{
                  stroke: failedCount > 0 ? '#f87171' : totalProgress === 100 ? '#4ade80' : '#60a5fa'
                }}
              />
              <text x="18" y="20.35" className="percentage">{totalProgress}%</text>
            </svg>
          </div>
        </div>
      </div>

      <div className="timeline-content">
        <div className="timeline-line" />
        
        <div className="events-list">
          {events.map((event, index) => {
            const statusConfig = getStatusConfig(event.status);
            const isLast = index === events.length - 1;

            return (
              <div 
                key={event.id} 
                className={`timeline-event ${event.status} ${isLast ? 'last' : ''}`}
              >
                <div 
                  className="event-marker"
                  style={{ 
                    backgroundColor: statusConfig.color,
                    boxShadow: `0 0 10px ${statusConfig.color}`
                  }}
                >
                  <span className="marker-icon">{statusConfig.icon}</span>
                </div>
                
                <div className="event-content">
                  <div className="event-header">
                    <span className="event-title">{event.title}</span>
                    <span 
                      className="event-status"
                      style={{ color: statusConfig.color }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                  
                  <div className="event-details">
                    {event.agentName && (
                      <span className="detail agent">
                        🤖 {event.agentName}
                      </span>
                    )}
                    <span className="detail duration">
                      ⏱️ {formatDuration(event.duration)}
                    </span>
                    
                    <span className="detail order">
                      #{index + 1}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {events.length === 0 && (
        <div className="timeline-empty">
          <span className="empty-icon">📋</span>
          <p>暂无任务事件</p>
        </div>
      )}
    </div>
  );
};
