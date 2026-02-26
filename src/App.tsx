import { AgentCanvas } from './components/AgentCanvas';
import './App.css';

function App() {
  // 配置你的API信息（实际使用时应从环境变量读取）
  const apiConfig = {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
    baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo'
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 AI Agent Visualizer</h1>
        <p>Watch your AI agents come to life</p>
      </header>
      
      <main>
        <AgentCanvas 
          apiConfig={apiConfig.apiKey ? apiConfig : undefined}
          config={{
            id: 'agent-1',
            name: 'Pixel Agent',
            position: { x: 400, y: 280 }
          }}
        />
      </main>

      <footer className="app-footer">
        <p>Powered by React + Canvas 2D + OpenAI Compatible API</p>
      </footer>
    </div>
  );
}

export default App;
