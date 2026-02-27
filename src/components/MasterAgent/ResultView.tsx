import React, { useState } from 'react';
import './ResultView.css';

interface SubTaskResult {
  title: string;
  status: 'completed' | 'failed' | 'pending';
  agentName?: string;
  result?: string;
  error?: string;
  durationMs?: number;
}

interface ResultViewProps {
  taskId: string;
  originalTask: string;
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
  onExport?: (format: 'markdown' | 'html' | 'json') => void;
  onClose?: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  taskId,
  originalTask,
  summary,
  report,
  subTaskResults,
  metrics,
  onExport,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'report' | 'json'>('summary');
  const [selectedSubtask, setSelectedSubtask] = useState<number | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // 格式化时长
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // 下载文件
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 获取状态配置
  const getStatusConfig = (status: SubTaskResult['status']) => {
    switch (status) {
      case 'completed':
        return { color: '#4ade80', icon: '✅', label: '完成' };
      case 'failed':
        return { color: '#f87171', icon: '❌', label: '失败' };
      default:
        return { color: '#9ca3af', icon: '⏳', label: '待定' };
    }
  };

  // 渲染导出按钮
  const ExportButton = ({ format, label, icon }: { format: 'markdown' | 'html' | 'json'; label: string; icon: string }) => (
    <button
      className="export-btn"
      onClick={() => {
        onExport?.(format);
        const content = format === 'json' 
          ? JSON.stringify({ taskId, originalTask, summary, metrics, subTaskResults }, null, 2)
          : format === 'html'
          ? `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>任务报告</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6}h1{color:#333}h2{color:#555;margin-top:30px}pre{background:#f5f5f5;padding:15px;border-radius:4px;overflow-x:auto}</style></head><body>${report.replace(/\n/g, '<br>').replace(/# (.*)/g, '<h1>$1</h1>').replace(/## (.*)/g, '<h2>$1</h2>')}</body></html>`
          : report;
        downloadFile(content, `task-report-${taskId.slice(-8)}.${format === 'markdown' ? 'md' : format}`, 
          format === 'json' ? 'application/json' : format === 'html' ? 'text/html' : 'text/markdown');
      }}
    >
      <span className="btn-icon">{icon}</span>
      <span className="btn-label">{label}</span>
    </button>
  );

  return (
    <div className="result-view">
      <div className="result-header">
        <div className="header-main">
          <h2>📊 任务执行结果</h2>
          <p className="task-id">任务ID: {taskId.slice(0, 20)}...</p>
        </div>
        
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="result-tabs">
        {[
          { key: 'summary', label: '📋 摘要', icon: '📋' },
          { key: 'details', label: '📝 详情', icon: '📝' },
          { key: 'report', label: '📄 报告', icon: '📄' },
          { key: 'json', label: '💻 JSON', icon: '💻' }
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="result-content">
        {activeTab === 'summary' && (
          <div className="tab-panel summary-panel">
            <div className="summary-card">
              <h3>🎯 任务</h3>
              <p className="original-task">{originalTask}</p>
            </div>

            <div className="summary-card">
              <h3>📊 执行摘要</h3>
              <p className="summary-text">{summary}</p>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-value" style={{ color: '#4ade80' }}>
                  {metrics.successRate}%
                </span>
                <span className="metric-label">成功率</span>
              </div>
              
              <div className="metric-card">
                <span className="metric-value">{metrics.completedSubTasks}/{metrics.totalSubTasks}</span>
                <span className="metric-label">完成/总数</span>
              </div>
              
              <div className="metric-card">
                <span className="metric-value" style={{ color: '#f87171' }}>{metrics.failedSubTasks}</span>
                <span className="metric-label">失败</span>
              </div>
              
              <div className="metric-card">
                <span className="metric-value">{formatDuration(metrics.totalDurationMs)}</span>
                <span className="metric-label">总耗时</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="tab-panel details-panel">
            <div className="subtask-list">
              {subTaskResults.map((result, index) => {
                const statusConfig = getStatusConfig(result.status);
                const isSelected = selectedSubtask === index;

                return (
                  <div 
                    key={index}
                    className={`subtask-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedSubtask(isSelected ? null : index)}
                  >
                    <div className="subtask-header">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: statusConfig.color }}
                      >
                        {statusConfig.icon}
                      </span>
                      
                      <span className="subtask-title">{result.title}</span>
                      
                      <span className="subtask-duration">
                        {result.durationMs ? formatDuration(result.durationMs) : '--'}
                      </span>
                    </div>

                    {result.agentName && (
                      <div className="subtask-agent">
                        🤖 {result.agentName}
                      </div>
                    )}

                    {isSelected && (
                      <div className="subtask-detail">
                        {result.result && (
                          <div className="result-section">
                            <h4>执行结果</h4>
                            <pre>{result.result}</pre>
                          </div>
                        )}
                        
                        {result.error && (
                          <div className="error-section">
                            <h4>错误信息</h4>
                            <pre className="error">{result.error}</pre>
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

        {activeTab === 'report' && (
          <div className="tab-panel report-panel">
            <div className="report-actions">
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(report, 'markdown')}
              >
                {copiedFormat === 'markdown' ? '✅ 已复制' : '📋 复制'}
              </button>
            </div>
            <pre className="report-content">{report}</pre>
          </div>
        )}

        {activeTab === 'json' && (
          <div className="tab-panel json-panel">
            <div className="report-actions">
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(
                  JSON.stringify({ taskId, originalTask, summary, metrics, subTaskResults }, null, 2),
                  'json'
                )}
              >
                {copiedFormat === 'json' ? '✅ 已复制' : '📋 复制'}
              </button>
            </div>
            <pre className="json-content">
              {JSON.stringify({ taskId, originalTask, summary, metrics, subTaskResults }, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="result-footer">
        <div className="export-section">
          <span className="export-label">📥 导出报告：</span>
          <div className="export-buttons">
            <ExportButton format="markdown" label="Markdown" icon="📝" />
            <ExportButton format="html" label="HTML" icon="🌐" />
            <ExportButton format="json" label="JSON" icon="💻" />
          </div>
        </div>
      </div>
    </div>
  );
};
