import { useState, useEffect, useCallback } from 'react';
import { OfficeScene } from './scenes/OfficeScene';
import { ModelConfigModal } from './components/ModelConfigModal';
import { AgentPanel } from './components/AgentPanel';
import { ConnectionStatus } from './components/ConnectionStatus';
import { VersionInfo } from './components/VersionInfo';
import { useAgentStore, initAgentStoreListeners } from './store/agentStore';
import type { ModelConfig } from './types';
import './App.css';

function App() {
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [showDemoButton, setShowDemoButton] = useState(true);
  
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
          <h1>🤖 AI Agent Visualizer</h1>
          <p className="subtitle">多模型 Agent 实时可视化</p>
        </div>
        <div className="header-right">
          <ConnectionStatus isConnected={isConnected} />
          <button 
            className="btn-primary"
            onClick={() => setIsModelModalOpen(true)}
          >
            + 添加 Agent
          </button>
          <button 
            className={`btn-secondary ${!showDemoButton ? 'active' : ''}`}
            onClick={handleToggleDemo}
          >
            {showDemoButton ? '▶ 演示模式' : '⏹ 停止演示'}
          </button>
        </div>
      </header>
      
      <main className="app-main">
        <div className="scene-container">
          <OfficeScene />
        </div>
        
        {selectedAgent && (
          <AgentPanel 
            agent={selectedAgent} 
            onDelete={() => handleDeleteAgent(selectedAgent.id)}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Phase 3 | 多模型集成 + 实时状态同步</p>
        <p className="credits">
          {agents.length} 个 Agent | 点击 Agent 选中 · 拖拽移动 · 实时对话
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
