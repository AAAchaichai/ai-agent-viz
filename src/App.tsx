import { useState, useEffect, useCallback } from 'react';
import { OfficeScene } from './scenes/OfficeScene';
import { ModelConfigModal } from './components/ModelConfigModal';
import { AgentPanel } from './components/AgentPanel';
import { ConnectionStatus } from './components/ConnectionStatus';
import { VersionInfo } from './components/VersionInfo';
import { MasterAgentPanel } from './components/MasterAgent';
import { useAgentStore, initAgentStoreListeners } from './store/agentStore';
import type { ModelConfig } from './types';
import './App.css';

// 视图模式
type ViewMode = 'master' | 'agents';

function App() {
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [showDemoButton, setShowDemoButton] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('master'); // 默认显示总指挥
  
  const { 
    agents, 
    selectedAgentId, 
    presetModels, 
    isConnected,
    createServerAgent, 
    deleteServerAgent,
    startDemoMode, 
    stopDemoMode 
  } = useAgentStore();

  // 初始化监听器
  useEffect(() => {
    initAgentStoreListeners();
  }, []);

  const handleCreateAgent = useCallback(async (name: string, config: ModelConfig) => {
    try {
      await createServerAgent(name, config);
      setIsModelModalOpen(false);
    } catch (error) {
      alert('创建 Agent 失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [createServerAgent]);

  const handleDeleteAgent = useCallback(async (id: string) => {
    if (confirm('确定要删除这个 Agent 吗？')) {
      try {
        await deleteServerAgent(id);
      } catch (error) {
        alert('删除 Agent 失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [deleteServerAgent]);

  const handleToggleDemo = useCallback(() => {
    if (showDemoButton) {
      startDemoMode();
    } else {
      stopDemoMode();
    }
    setShowDemoButton(!showDemoButton);
  }, [showDemoButton, startDemoMode, stopDemoMode]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>🤖 AI Agent 总指挥系统</h1>
          <p className="subtitle">多Agent协同任务调度与执行平台</p>
        </div>
        <div className="header-center">
          <div className="view-mode-toggle">
            <button 
              className={`mode-btn ${viewMode === 'master' ? 'active' : ''}`}
              onClick={() => setViewMode('master')}
            >
              🎯 总指挥模式
            </button>
            <button 
              className={`mode-btn ${viewMode === 'agents' ? 'active' : ''}`}
              onClick={() => setViewMode('agents')}
            >
              👥 Agent管理
            </button>
          </div>
        </div>
        <div className="header-right">
          <ConnectionStatus isConnected={isConnected} />
          <button 
            className="btn-primary"
            onClick={() => setIsModelModalOpen(true)}
          >
            + 添加 Agent
          </button>
          {viewMode === 'agents' && (
            <button 
              className={`btn-secondary ${!showDemoButton ? 'active' : ''}`}
              onClick={handleToggleDemo}
            >
              {showDemoButton ? '▶ 演示模式' : '⏹ 停止演示'}
            </button>
          )}
        </div>
      </header>
      
      <main className="app-main">
        {viewMode === 'master' ? (
          // 总指挥模式：显示总指挥面板
          <MasterAgentPanel />
        ) : (
          // Agent管理模式：原来的界面
          <>
            <div className="scene-container">
              <OfficeScene />
            </div>
            
            {selectedAgent && (
              <AgentPanel 
                agent={selectedAgent} 
                onDelete={() => handleDeleteAgent(selectedAgent.id)}
              />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Phase 4 | 总指挥系统 | 多Agent协同调度</p>
        <p className="credits">
          {agents.length} 个 Agent | {viewMode === 'master' ? '总指挥协调模式' : '独立管理模式'}
        </p>
        <VersionInfo />
      </footer>

      <ModelConfigModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        onSave={handleCreateAgent}
        presetModels={presetModels}
      />
    </div>
  );
}

export default App;
