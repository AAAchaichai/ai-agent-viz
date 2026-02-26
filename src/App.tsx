import { OfficeScene } from './scenes/OfficeScene';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 AI Agent Visualizer</h1>
        <p className="subtitle">像素风格 AI Agent 实时可视化</p>
      </header>
      
      <main className="app-main">
        <OfficeScene />
      </main>

      <footer className="app-footer">
        <p>MVP v0.2 | React + Canvas 2D + Zustand</p>
        <p className="credits">点击 Agent 选中 · 自动循环演示状态</p>
      </footer>
    </div>
  );
}

export default App;
