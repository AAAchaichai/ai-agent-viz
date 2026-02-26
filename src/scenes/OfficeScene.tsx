import { useEffect, useRef, useCallback, useState } from 'react';
import { CanvasEngine } from '../engine/CanvasEngine';
import { PixelAgentRenderer } from '../engine/PixelAgentRenderer';
import { ThoughtBubbleRenderer } from '../engine/ThoughtBubbleRenderer';
import { MessageRenderer } from '../engine/MessageRenderer';
import { ConnectionRenderer } from '../engine/ConnectionRenderer';
import { useAgentStore, type Agent } from '../store/agentStore';
import './OfficeScene.css';

// 演示模式状态
interface DemoState {
  isRunning: boolean;
  round: number;
  currentSpeaker: string | null;
  messages: Array<{
    from: string;
    to: string;
    content: string;
  }>;
}

export function OfficeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const agentRendererRef = useRef<PixelAgentRenderer | null>(null);
  const bubbleRendererRef = useRef<ThoughtBubbleRenderer | null>(null);
  const messageRendererRef = useRef<MessageRenderer | null>(null);
  const connectionRendererRef = useRef<ConnectionRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const demoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [demoState, setDemoState] = useState<DemoState>({
    isRunning: false,
    round: 0,
    currentSpeaker: null,
    messages: []
  });
  
  const { 
    agents, 
    selectedAgentId, 
    viewport, 
    setViewport,
    selectAgent,
    addAgent,
    updateAgentState,
    updateAgentMessage
  } = useAgentStore();

  // 初始化画布引擎
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const engine = new CanvasEngine(canvasRef.current, 800, 600);
    engineRef.current = engine;
    agentRendererRef.current = new PixelAgentRenderer();
    bubbleRendererRef.current = new ThoughtBubbleRenderer();
    messageRendererRef.current = new MessageRenderer();
    connectionRendererRef.current = new ConnectionRenderer();
    
    // 动画循环
    const animate = () => {
      // 更新消息和连接
      messageRendererRef.current?.update();
      connectionRendererRef.current?.update();
      
      // 请求下一帧
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    
    // 设置渲染回调
    engine.onRender((renderContext) => {
      const { ctx } = renderContext;
      
      // 渲染连接线（在Agent下方）
      connectionRendererRef.current?.render(ctx);
      
      // 渲染所有 Agent
      agents.forEach(agent => {
        const isSelected = agent.id === selectedAgentId;
        agentRendererRef.current?.render(renderContext, agent, isSelected);
        bubbleRendererRef.current?.render(
          renderContext, 
          agent.position.x, 
          agent.position.y - 40, 
          agent.state,
          agent.message
        );
      });
      
      // 渲染消息气泡（在最上层）
      messageRendererRef.current?.render(ctx);
    });
    
    engine.start();
    
    return () => {
      engine.stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (demoTimeoutRef.current) {
        clearTimeout(demoTimeoutRef.current);
      }
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
      addAgent({ name: '海绵宝宝', position: { x: 200, y: 280 } });
      addAgent({ name: '派大星', position: { x: 400, y: 250 } });
      addAgent({ name: '章鱼哥', position: { x: 600, y: 280 } });
    }
  }, []);

  // 多Agent协作演示
  const startCollaborationDemo = useCallback(() => {
    if (agents.length < 2 || demoState.isRunning) return;

    setDemoState({
      isRunning: true,
      round: 0,
      currentSpeaker: null,
      messages: []
    });

    const demoMessages = [
      { from: 0, to: 1, content: "派大星，你觉得AI助手最重要的是什么？" },
      { from: 1, to: 0, content: "我觉得最重要的是理解用户的真实需求！" },
      { from: 0, to: 1, content: "没错！还有就是要给用户带来惊喜。" },
      { from: 1, to: 2, content: "章鱼哥，你怎么看？" },
      { from: 2, to: 1, content: "我只想让你们都安静一点..." },
      { from: 1, to: 0, content: "哈哈，章鱼哥还是老样子。" }
    ];

    let messageIndex = 0;

    const playNextMessage = () => {
      if (messageIndex >= demoMessages.length) {
        // 演示结束
        setDemoState(prev => ({ ...prev, isRunning: false, currentSpeaker: null }));
        // 重置所有Agent状态
        agents.forEach(agent => updateAgentState(agent.id, 'idle'));
        return;
      }

      const msg = demoMessages[messageIndex];
      const fromAgent = agents[msg.from];
      const toAgent = agents[msg.to];

      if (!fromAgent || !toAgent) {
        messageIndex++;
        playNextMessage();
        return;
      }

      // 步骤1: 发送者思考
      setDemoState(prev => ({ ...prev, currentSpeaker: fromAgent.id }));
      updateAgentState(fromAgent.id, 'thinking');

      demoTimeoutRef.current = setTimeout(() => {
        // 步骤2: 发送者输入
        updateAgentState(fromAgent.id, 'typing');

        demoTimeoutRef.current = setTimeout(() => {
          // 步骤3: 创建消息和连接
          updateAgentMessage(fromAgent.id, msg.content);
          
          // 添加消息气泡
          messageRendererRef.current?.addBubble(
            `msg-${Date.now()}`,
            fromAgent.id,
            fromAgent.name,
            msg.content,
            fromAgent.position
          );

          // 创建连接线
          const connectionId = `conn-${Date.now()}`;
          connectionRendererRef.current?.createConnection(
            connectionId,
            fromAgent.id,
            toAgent.id,
            fromAgent.position,
            toAgent.position,
            fromAgent.color,
            msg.content.slice(0, 10)
          );

          // 步骤4: 接收者思考
          demoTimeoutRef.current = setTimeout(() => {
            updateAgentState(fromAgent.id, 'idle');
            setDemoState(prev => ({ ...prev, currentSpeaker: toAgent.id }));
            updateAgentState(toAgent.id, 'thinking');

            demoTimeoutRef.current = setTimeout(() => {
              // 步骤5: 接收者回复
              updateAgentState(toAgent.id, 'typing');
              updateAgentMessage(toAgent.id, '收到消息...');

              demoTimeoutRef.current = setTimeout(() => {
                // 清理
                connectionRendererRef.current?.removeConnection(connectionId);
                updateAgentState(toAgent.id, 'idle');
                updateAgentMessage(toAgent.id, '');
                updateAgentMessage(fromAgent.id, '');
                
                messageIndex++;
                playNextMessage();
              }, 1500);
            }, 1000);
          }, 1500);
        }, 1500);
      }, 1000);
    };

    playNextMessage();
  }, [agents, demoState.isRunning, updateAgentState, updateAgentMessage]);

  const stopCollaborationDemo = useCallback(() => {
    if (demoTimeoutRef.current) {
      clearTimeout(demoTimeoutRef.current);
    }
    connectionRendererRef.current?.clear();
    setDemoState({
      isRunning: false,
      round: 0,
      currentSpeaker: null,
      messages: []
    });
    agents.forEach(agent => {
      updateAgentState(agent.id, 'idle');
      updateAgentMessage(agent.id, '');
    });
  }, [agents, updateAgentState, updateAgentMessage]);

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
        <div className="scene-actions">
          <button
            className={`demo-btn ${demoState.isRunning ? 'active' : ''}`}
            onClick={demoState.isRunning ? stopCollaborationDemo : startCollaborationDemo}
            disabled={agents.length < 2}
          >
            {demoState.isRunning ? '⏹ 停止演示' : '▶ 协作演示'}
          </button>
          <div className="agent-count">
            在线: {agents.length} 个 Agent
          </div>
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
      
      {demoState.isRunning && (
        <div className="demo-status">
          <div className="demo-indicator">
            <span className="pulse"></span>
            演示进行中...
          </div>
          <div className="demo-progress">
            {agents.find(a => a.id === demoState.currentSpeaker)?.name || '等待中'}
          </div>
        </div>
      )}
      
      <div className="agent-list">
        <h3>👥 在线 Agents</h3>
        <div className="agent-grid">
          {agents.map(agent => (
            <div 
              key={agent.id}
              className={`agent-card ${selectedAgentId === agent.id ? 'selected' : ''} ${demoState.currentSpeaker === agent.id ? 'speaking' : ''}`}
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
