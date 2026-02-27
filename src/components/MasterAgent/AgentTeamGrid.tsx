import React from 'react';
import type { SubAgent } from '../../store/masterStore';
import './AgentTeamGrid.css';

interface AgentTeamGridProps {
  agents: SubAgent[];
  onAgentClick?: (agent: SubAgent) => void;
  selectedAgentId?: string;
}

const AGENT_AVATARS: Record<string, string> = {
  '海绵宝宝': '🧽',
  '派大星': '⭐',
  '章鱼哥': '🐙',
  '蟹老板': '🦀',
  '珊迪': '🐿️',
  '小蜗': '🐌'
};

const getDefaultAvatar = (name: string): string => {
  for (const [key, avatar] of Object.entries(AGENT_AVATARS)) {
    if (name.includes(key)) return avatar;
  }
  return '🤖';
};

const getStatusConfig = (status: SubAgent['status']) => {
  switch (status) {
    case 'idle':
      return { color: '#6b7280', bgColor: '#374151', label: '空闲', icon: '💤' };
    case 'thinking':
      return { color: '#fbbf24', bgColor: '#92400e', label: '思考中', icon: '🤔' };
    case 'typing':
      return { color: '#60a5fa', bgColor: '#1e40af', label: '执行中', icon: '⚡' };
    case 'error':
      return { color: '#f87171', bgColor: '#991b1b', label: '错误', icon: '❌' };
    case 'success':
      return { color: '#4ade80', bgColor: '#166534', label: '完成', icon: '✅' };
    default:
      return { color: '#6b7280', bgColor: '#374151', label: '未知', icon: '❓' };
  }
};

export const AgentTeamGrid: React.FC<AgentTeamGridProps> = ({ 
  agents, 
  onAgentClick,
  selectedAgentId 
}) => {
  if (agents.length === 0) {
    return (
      <div className="agent-team-grid empty">
        <div className="empty-state">
          <span className="empty-icon">🤖</span>
          <p>暂无子Agent</p>
          <span className="empty-hint">分析任务后将自动创建团队</span>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-team-grid">
      <div className="grid-header">
        <span className="grid-title">🤖 子Agent团队 ({agents.length})</span>
        <div className="grid-stats">
          <span className="stat active">
            {agents.filter(a => a.status !== 'idle').length} 活跃
          </span>
          <span className="stat completed">
            {agents.reduce((sum, a) => sum + a.completedTasks, 0)} 已完成
          </span>
        </div>
      </div>
      
      <div className="grid-content">
        {agents.map(agent => {
          const statusConfig = getStatusConfig(agent.status);
          const isSelected = selectedAgentId === agent.id;
          const avatar = getDefaultAvatar(agent.name);

          return (
            <div
              key={agent.id}
              className={`agent-card ${isSelected ? 'selected' : ''} ${agent.status}`}
              onClick={() => onAgentClick?.(agent)}
              style={{ '--status-color': statusConfig.color } as React.CSSProperties}
            >
              <div className="card-glow" style={{ backgroundColor: statusConfig.color }} />
              
              <div className="card-content">
                <div className="agent-avatar">
                  <span className="avatar-emoji">{avatar}</span>
                  <div 
                    className="status-indicator"
                    style={{ backgroundColor: statusConfig.color }}
                    title={statusConfig.label}
                  />
                </div>
                
                <div className="agent-info">
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-role">{agent.role}</div>
                  
                  <div className="agent-skills">
                    {agent.skills.slice(0, 3).map((skill, idx) => (
                      <span 
                        key={idx} 
                        className="skill-tag"
                        title={skill}
                      >
                        {skill.slice(0, 4)}
                      </span>
                    ))}
                    {agent.skills.length > 3 && (
                      <span className="skill-tag more">+{agent.skills.length - 3}</span>
                    )}
                  </div>
                </div>
                
                <div className="agent-metrics">
                  <div className="metric">
                    <span className="metric-icon">✓</span>
                    <span className="metric-value">{agent.completedTasks}</span>
                  </div>
                  
                  {agent.currentTaskId && (
                    <div className="current-task">
                      <span className="task-indicator">📝</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div 
                className="status-bar"
                style={{ 
                  backgroundColor: statusConfig.bgColor,
                  color: statusConfig.color 
                }}
              >
                <span className="status-icon">{statusConfig.icon}</span>
                <span className="status-label">{statusConfig.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
