import { useEffect, useRef, useCallback } from 'react';
import { CanvasEngine } from '../engine/CanvasEngine';
import { PixelAgentRenderer } from '../engine/PixelAgentRenderer';
import { ThoughtBubbleRenderer } from '../engine/ThoughtBubbleRenderer';
import { useAgentStore, type Agent } from '../store/agentStore';
import './OfficeScene.css';

export function OfficeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const agentRendererRef = useRef<PixelAgentRenderer | null>(null);
  const bubbleRendererRef = useRef<ThoughtBubbleRenderer | null>(null);
  
  const { 
    agents, 
    selectedAgentId, 
    viewport, 
    setViewport,
    selectAgent,
    addAgent,
    startDemoMode,
    stopDemoMode
  } = useAgentStore();

  // 初始化画布引擎
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const engine = new CanvasEngine(canvasRef.current, 800, 600);
    engineRef.current = engine;
    agentRendererRef.current = new PixelAgentRenderer();
    bubbleRendererRef.current = new ThoughtBubbleRenderer();
    
    // 设置渲染回调
    engine.onRender((ctx) => {
      // 渲染所有 Agent
      agents.forEach(agent => {
        const isSelected = agent.id === selectedAgentId;
        agentRendererRef.current?.render(ctx, agent, isSelected);
        bubbleRendererRef.current?.render(
          ctx, 
          agent.position.x, 
          agent.position.y - 40, 
          agent.state,
          agent.message
        );
      });
    });
    
    engine.start();
    
    return () => {
      engine.stop();
    };
  }, [agents, selectedAgentId]);

  // 同步视口
  useEffect(() => {
    engineRef.current?.setViewport(viewport.x, viewport.y, viewport.zoom);
  }, [viewport]);

  // 初始化：添加示例 Agent
  useEffect(() => {
    if (agents.length === 0) {
      // 添加 3 个示例 Agent
      addAgent({ name: '海绵宝宝', position: { x: 200, y: 250 } });
      addAgent({ name: '派大星', position: { x: 400, y: 250 } });
      addAgent({ name: '章鱼哥', position: { x: 600, y: 250 } });
    }
    
    // 启动演示模式
    startDemoMode();
    
    return () => {
      stopDemoMode();
    };
  }, []);

  // 处理画布点击
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // 转换为世界坐标
    const worldPos = engineRef.current.screenToWorld(screenX, screenY);
    
    // 检查是否点击了 Agent
    let clickedAgent: Agent | null = null;
    for (const agent of agents) {
      const dx = worldPos.x - agent.position.x;
      const dy = worldPos.y - agent.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 40) {
        clickedAgent = agent;
        break;
      }
    }
    
    if (clickedAgent) {
      selectAgent(clickedAgent.id);
    } else {
      selectAgent(null);
    }
  }, [agents, selectAgent]);

  // 处理缩放
  const handleZoomIn = () => {
    setViewport({ zoom: viewport.zoom * 1.2 });
  };

  const handleZoomOut = () => {
    setViewport({ zoom: viewport.zoom / 1.2 });
  };

  const handleResetView = () => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  return (
    <div className="office-scene">
      <div className="scene-header">
        <h2>🏢 AI Agent 办公室</h2>
        <div className="agent-count">
          在线: {agents.length} 个 Agent
        </div>
      </div>
      
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="office-canvas"
          onClick={handleCanvasClick}
        />
        
        <div className="canvas-controls">
          <button onClick={handleZoomIn} title="放大">🔍+</button>
          <button onClick={handleZoomOut} title="缩小">🔍-</button>
          <button onClick={handleResetView} title="重置视图">⌖</button>
        </div>
        
        <div className="zoom-level">
          {Math.round(viewport.zoom * 100)}%
        </div>
      </div>
      
      <div className="agent-list">
        <h3>👥 在线 Agents</h3>
        <div className="agent-grid">
          {agents.map(agent => (
            <div 
              key={agent.id}
              className={`agent-card ${selectedAgentId === agent.id ? 'selected' : ''}`}
              onClick={() => selectAgent(agent.id)}
            >
              <div 
                className="agent-avatar"
                style={{ backgroundColor: agent.color }}
              >
                🤖
              </div>
              <div className="agent-info">
                <div className="agent-name">{agent.name}</div>
                <div className="agent-state">
                  <span 
                    className="state-dot"
                    style={{ backgroundColor: agent.color }}
                  />
                  {agent.state}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="legend">
        <h4>📊 状态说明</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#888888' }} />
            <span>Idle - 待机中</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#FFD93D' }} />
            <span>Thinking - 思考中</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#6BCF7F' }} />
            <span>Typing - 输出中</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#FF6B6B' }} />
            <span>Error - 出错了</span>
          </div>
        </div>
      </div>
    </div>
  );
}
