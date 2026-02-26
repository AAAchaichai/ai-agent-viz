import React, { useState } from 'react';
import { useAgentStore } from '../store/agentStore';
import type { Agent } from '../store/agentStore';
import './AgentPanel.css';

interface AgentPanelProps {
  agent: Agent;
  onDelete: () => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ agent, onDelete }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { agents, sendMessageToAgent, sendMessageBetweenAgents } = useAgentStore();
  
  // 获取其他 Agents（用于协作）
  const otherAgents = agents.filter(a => a.id !== agent.id);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    try {
      await sendMessageToAgent(agent.id, message);
      setMessage('');
    } finally {
      setIsSending(false);
    }
  };

  const handleCollaborate = async (targetAgentId: string) => {
    const question = `你好，我是${agent.name}。能帮我分析一下当前的系统状态吗？`;
    try {
      await sendMessageBetweenAgents(agent.id, targetAgentId, question);
    } catch (error) {
      console.error('Collaboration failed:', error);
    }
  };

  const getStateColor = (state: string) => {
    const colors: Record<string, string> = {
      idle: '#888888',
      thinking: '#FFD93D',
      typing: '#6BCF7F',
      error: '#FF6B6B',
      success: '#4DABF7'
    };
    return colors[state] || '#888888';
  };

  const getStateLabel = (state: string) => {
    const labels: Record<string, string> = {
      idle: '空闲',
      thinking: '思考中',
      typing: '响应中',
      error: '错误',
      success: '完成'
    };
    return labels[state] || state;
  };

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <h3>{agent.name}</h3>
        <div 
          className="status-badge"
          style={{ 
            backgroundColor: getStateColor(agent.state) + '20',
            color: getStateColor(agent.state)
          }}
        >
          <span 
            className="status-dot"
            style={{ backgroundColor: getStateColor(agent.state) }}
          />
          {getStateLabel(agent.state)}
        </div>
      </div>

      {agent.modelConfig && (
        <div className="model-info">
          <div className="info-row">
            <span className="info-label">模型:</span>
            <span className="info-value">{agent.modelConfig.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">提供商:</span>
            <span className="info-value">{agent.modelConfig.provider}</span>
          </div>
        </div>
      )}

      <div className="message-section">
        <label>发送消息</label>
        <div className="message-input-group">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="输入消息..."
            disabled={isSending}
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending || !message.trim()}
            className="send-btn"
          >
            {isSending ? (
              <>
                <span className="spinner-small"></span>
                发送中...
              </>
            ) : '发送'}
          </button>
        </div>
      </div>

      {agent.message && (
        <div className="response-box">
          <strong>最新响应:</strong>
          <div className="response-content">{agent.message}</div>
        </div>
      )}

      {otherAgents.length > 0 && (
        <div className="collaboration-section">
          <label>协作 Agents</label>
          <div className="collaboration-list">
            {otherAgents.map((otherAgent) => (
              <button
                key={otherAgent.id}
                onClick={() => handleCollaborate(otherAgent.id)}
                className="collab-btn"
              >
                <span 
                  className="agent-status-dot"
                  style={{ backgroundColor: getStateColor(otherAgent.state) }}
                />
                <span>向 {otherAgent.name} 提问</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={onDelete} className="delete-btn">
        🗑️ 删除 Agent
      </button>
    </div>
  );
};
