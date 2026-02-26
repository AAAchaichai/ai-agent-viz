import { useEffect, useRef, useState, useCallback } from 'react';
import { SpriteRenderer } from '../engine/SpriteRenderer';
import { AgentStateMachine } from '../engine/AgentStateMachine';
import { GameLoop } from '../engine/GameLoop';
import { OpenAICompatibleAPI } from '../api/OpenAICompatibleAPI';
import type { AgentState, AgentConfig, AgentMessage } from '../types';
import './AgentCanvas.css';

interface AgentCanvasProps {
  config?: Partial<AgentConfig>;
  apiConfig?: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

const defaultConfig: AgentConfig = {
  id: 'agent-1',
  name: 'AI Agent',
  position: { x: 400, y: 300 }
};

export function AgentCanvas({ config = {}, apiConfig }: AgentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRendererRef = useRef<SpriteRenderer | null>(null);
  const stateMachineRef = useRef<AgentStateMachine | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const apiRef = useRef<OpenAICompatibleAPI | null>(null);
  
  const [state, setState] = useState<AgentState>('idle');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const mergedConfig = { ...defaultConfig, ...config };

  // 初始化
  useEffect(() => {
    if (!canvasRef.current) return;

    // 初始化渲染器
    spriteRendererRef.current = new SpriteRenderer(canvasRef.current);
    
    // 初始化状态机
    stateMachineRef.current = new AgentStateMachine();
    stateMachineRef.current.onStateChange((newState) => {
      setState(newState);
      spriteRendererRef.current?.setAnimation(newState);
    });

    // 初始化API
    if (apiConfig) {
      apiRef.current = new OpenAICompatibleAPI(
        apiConfig,
        stateMachineRef.current,
        (newState) => setState(newState)
      );
    }

    // 初始化游戏循环
    gameLoopRef.current = new GameLoop({
      onUpdate: (deltaTime) => {
        spriteRendererRef.current?.update(deltaTime);
        stateMachineRef.current?.update(deltaTime);
      },
      onRender: () => {
        if (spriteRendererRef.current) {
          spriteRendererRef.current.render(
            mergedConfig.position.x,
            mergedConfig.position.y,
            state
          );
        }
      }
    });

    gameLoopRef.current.start();
    setIsConnected(true);

    return () => {
      gameLoopRef.current?.stop();
    };
  }, []);

  // 状态变化时更新动画
  useEffect(() => {
    spriteRendererRef.current?.setAnimation(state);
  }, [state]);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !apiRef.current) return;

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }]);

    let fullContent = '';

    await apiRef.current.sendMessage(
      [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: inputText }
      ],
      (chunk) => {
        fullContent += chunk;
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: fullContent }
              : m
          )
        );
      },
      () => {
        console.log('Message complete');
      },
      (error) => {
        console.error('Error:', error);
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: 'Error: ' + error.message }
              : m
          )
        );
      }
    );
  }, [inputText, messages]);

  const handleStateTest = (newState: AgentState) => {
    stateMachineRef.current?.transition(newState);
  };

  return (
    <div className="agent-canvas-container">
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="agent-canvas"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>

      <div className="controls-panel">
        <div className="state-controls">
          <label>Test States:</label>
          <div className="state-buttons">
            {(['idle', 'typing', 'thinking', 'error', 'success'] as AgentState[]).map(s => (
              <button
                key={s}
                onClick={() => handleStateTest(s)}
                className={state === s ? 'active' : ''}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-panel">
          <div className="messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <strong>{msg.role}:</strong> {msg.content}
              </div>
            ))}
          </div>
          
          <div className="input-area">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={apiConfig ? "Type a message..." : "API not configured"}
              disabled={!apiConfig}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!apiConfig || !inputText.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
