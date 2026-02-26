import React from 'react';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  isConnected: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  return (
    <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
      <span className="status-indicator" />
      <span className="status-text">
        {isConnected ? '已连接' : '未连接'}
      </span>
    </div>
  );
};
