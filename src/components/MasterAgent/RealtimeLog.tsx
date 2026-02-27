import React, { useEffect, useRef, useState } from 'react';
import './RealtimeLog.css';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  source: string;
  message: string;
  metadata?: Record<string, any>;
}

interface RealtimeLogProps {
  logs: LogEntry[];
  maxHeight?: number;
  autoScroll?: boolean;
  filter?: string;
}

export const RealtimeLog: React.FC<RealtimeLogProps> = ({ 
  logs, 
  maxHeight = 300,
  autoScroll = true,
  filter = ''
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<Set<LogEntry['level']>>(
    new Set(['info', 'warn', 'error', 'success'])
  );

  // 自动滚动
  useEffect(() => {
    if (autoScroll && !isPaused && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    // 级别过滤
    if (!selectedLevels.has(log.level)) return false;
    
    // 文本过滤
    if (filter) {
      const searchText = filter.toLowerCase();
      return (
        log.message.toLowerCase().includes(searchText) ||
        log.source.toLowerCase().includes(searchText)
      );
    }
    
    return true;
  });

  // 获取日志级别样式
  const getLevelConfig = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return { color: '#60a5fa', bgColor: '#1e3a5f', icon: 'ℹ️', label: 'INFO' };
      case 'warn':
        return { color: '#fbbf24', bgColor: '#78350f', icon: '⚠️', label: 'WARN' };
      case 'error':
        return { color: '#f87171', bgColor: '#7f1d1d', icon: '❌', label: 'ERROR' };
      case 'success':
        return { color: '#4ade80', bgColor: '#14532d', icon: '✅', label: 'SUCCESS' };
      case 'debug':
        return { color: '#a78bfa', bgColor: '#4c1d95', icon: '🔍', label: 'DEBUG' };
      default:
        return { color: '#9ca3af', bgColor: '#374151', icon: '📝', label: 'LOG' };
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  // 切换级别过滤
  const toggleLevel = (level: LogEntry['level']) => {
    const newLevels = new Set(selectedLevels);
    if (newLevels.has(level)) {
      newLevels.delete(level);
    } else {
      newLevels.add(level);
    }
    setSelectedLevels(newLevels);
  };

  return (
    <div className="realtime-log">
      <div className="log-header">
        <div className="header-left">
          <span className="log-title">📝 实时日志</span>
          <span className="log-count">{filteredLogs.length}/{logs.length}</span>
        </div>
        
        <div className="header-right">
          <button 
            className={`pause-btn ${isPaused ? 'paused' : ''}`}
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
        </div>
      </div>

      <div className="log-filters">
        {(['info', 'warn', 'error', 'success', 'debug'] as LogEntry['level'][]).map(level => {
          const config = getLevelConfig(level);
          const isActive = selectedLevels.has(level);
          
          return (
            <button
              key={level}
              className={`filter-btn ${isActive ? 'active' : ''}`}
              onClick={() => toggleLevel(level)}
              style={{
                backgroundColor: isActive ? config.bgColor : 'transparent',
                color: config.color,
                borderColor: config.color
              }}
            >
              <span className="filter-icon">{config.icon}</span>
              <span className="filter-label">{config.label}</span>
              <span className="filter-count">
                {logs.filter(l => l.level === level).length}
              </span>
            </button>
          );
        })}
      </div>

      <div 
        className="log-content"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {filteredLogs.length === 0 ? (
          <div className="log-empty">
            <span className="empty-icon">📭</span>
            <p>{logs.length === 0 ? '暂无日志' : '没有匹配的日志'}</p>
          </div>
        ) : (
          <div className="log-entries">
            {filteredLogs.map((log, index) => {
              const config = getLevelConfig(log.level);
              const isNew = index === filteredLogs.length - 1;
              
              return (
                <div 
                  key={log.id} 
                  className={`log-entry ${log.level} ${isNew ? 'new' : ''}`}
                >
                  <div className="entry-timestamp">
                    {formatTime(log.timestamp)}
                  </div>
                  
                  <div 
                    className="entry-level"
                    style={{ 
                      backgroundColor: config.bgColor,
                      color: config.color 
                    }}
                  >
                    <span className="level-icon">{config.icon}</span>
                    <span className="level-label">{config.label}</span>
                  </div>
                  
                  <div className="entry-source">
                    [{log.source}]
                  </div>
                  
                  <div className="entry-message">
                    {log.message}
                  </div>
                  
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="entry-metadata">
                      {Object.entries(log.metadata).map(([key, value]) => (
                        <span key={key} className="metadata-item">
                          <span className="meta-key">{key}:</span>
                          <span className="meta-value">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {isPaused && (
        <div className="paused-indicator">
          ⏸️ 日志滚动已暂停
        </div>
      )}
    </div>
  );
};
