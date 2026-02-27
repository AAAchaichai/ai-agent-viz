import React, { useEffect, useRef, useState } from 'react';
import type { Subtask, SubAgent } from '../../store/masterStore';
import './TaskFlowGraph.css';

interface TaskFlowGraphProps {
  subtasks: Subtask[];
  agents: SubAgent[];
  taskId: string;
}

interface FlowNode {
  id: string;
  type: 'master' | 'subtask' | 'agent' | 'result';
  label: string;
  status?: string;
  x: number;
  y: number;
  color: string;
}

interface FlowEdge {
  from: string;
  to: string;
  animated: boolean;
  color: string;
}

export const TaskFlowGraph: React.FC<TaskFlowGraphProps> = ({ subtasks, agents, taskId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const animationRef = useRef<number | null>(null);
  const frameRef = useRef(0);

  // 计算节点布局
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const centerX = width / 2;
    const margin = 60;

    const newNodes: FlowNode[] = [];
    const newEdges: FlowEdge[] = [];

    // 1. 总指挥节点（顶部中央）
    newNodes.push({
      id: 'master',
      type: 'master',
      label: '🎯 总指挥',
      x: centerX,
      y: margin,
      color: '#FFD93D'
    });

    // 2. 子任务节点（第二行）
    const subtaskWidth = (width - margin * 2) / Math.max(subtasks.length, 1);
    subtasks.forEach((subtask, index) => {
      const x = margin + subtaskWidth * index + subtaskWidth / 2;
      const y = margin + 80;
      
      const color = subtask.status === 'completed' ? '#4ade80' :
                    subtask.status === 'failed' ? '#f87171' :
                    subtask.status === 'running' ? '#60a5fa' : '#9ca3af';

      newNodes.push({
        id: subtask.id,
        type: 'subtask',
        label: subtask.title.slice(0, 8),
        status: subtask.status,
        x,
        y,
        color
      });

      // 总指挥到子任务的边
      newEdges.push({
        from: 'master',
        to: subtask.id,
        animated: subtask.status === 'running',
        color
      });
    });

    // 3. Agent节点（第三行）
    const assignedAgents = new Map<string, SubAgent>();
    subtasks.forEach(subtask => {
      if (subtask.assignedAgentId) {
        const agent = agents.find(a => a.id === subtask.assignedAgentId);
        if (agent) assignedAgents.set(subtask.assignedAgentId, agent);
      }
    });

    const agentList = Array.from(assignedAgents.values());
    const agentWidth = (width - margin * 2) / Math.max(agentList.length || agents.length, 1);
    
    (agentList.length > 0 ? agentList : agents).forEach((agent, index) => {
      const x = margin + agentWidth * index + agentWidth / 2;
      const y = margin + 160;
      
      const color = agent.status === 'thinking' ? '#fbbf24' :
                    agent.status === 'success' ? '#4ade80' :
                    agent.status === 'error' ? '#f87171' : '#6b7280';

      newNodes.push({
        id: agent.id,
        type: 'agent',
        label: agent.name.slice(0, 6),
        status: agent.status,
        x,
        y,
        color
      });

      // 找到分配给这个Agent的子任务并连接
      subtasks.forEach(subtask => {
        if (subtask.assignedAgentId === agent.id) {
          newEdges.push({
            from: subtask.id,
            to: agent.id,
            animated: subtask.status === 'running' || agent.status === 'thinking',
            color
          });
        }
      });
    });

    // 4. 结果节点（底部）
    newNodes.push({
      id: 'result',
      type: 'result',
      label: '📊 结果',
      x: centerX,
      y: margin + 240,
      color: '#a78bfa'
    });

    // Agent到结果的边
    (agentList.length > 0 ? agentList : agents).forEach(agent => {
      newEdges.push({
        from: agent.id,
        to: 'result',
        animated: agent.status === 'success',
        color: agent.status === 'success' ? '#4ade80' : '#6b7280'
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [subtasks, agents, taskId]);

  // 绘制画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameRef.current += 1;

      // 绘制边
      edges.forEach(edge => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return;

        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y + 20);
        
        // 贝塞尔曲线
        const cpY = (fromNode.y + toNode.y) / 2;
        ctx.bezierCurveTo(
          fromNode.x, cpY,
          toNode.x, cpY,
          toNode.x, toNode.y - 20
        );

        ctx.strokeStyle = edge.color;
        ctx.lineWidth = edge.animated ? 3 : 2;
        ctx.stroke();

        // 动画效果
        if (edge.animated) {
          const progress = (frameRef.current % 60) / 60;
          const dotX = fromNode.x + (toNode.x - fromNode.x) * progress;
          const dotY = fromNode.y + 20 + (toNode.y - fromNode.y - 40) * progress;
          
          ctx.beginPath();
          ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }

        // 箭头
        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        ctx.beginPath();
        ctx.moveTo(toNode.x, toNode.y - 20);
        ctx.lineTo(
          toNode.x - 8 * Math.cos(angle - Math.PI / 6),
          toNode.y - 20 - 8 * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(toNode.x, toNode.y - 20);
        ctx.lineTo(
          toNode.x - 8 * Math.cos(angle + Math.PI / 6),
          toNode.y - 20 - 8 * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      });

      // 绘制节点
      nodes.forEach(node => {
        // 节点背景（圆角矩形）
        const x = node.x - 40;
        const y = node.y - 20;
        const w = 80;
        const h = 40;
        const r = 8;
        
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        
        ctx.fillStyle = 'rgba(26, 26, 62, 0.9)';
        ctx.fill();
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 节点标签
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y);

        // 状态指示器
        if (node.status) {
          ctx.beginPath();
          ctx.arc(node.x + 35, node.y - 15, 4, 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.fill();
        }
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, edges]);

  return (
    <div className="task-flow-graph">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={320}
        className="flow-canvas"
      />
      <div className="flow-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#4ade80' }}></span>
          <span>已完成</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#60a5fa' }}></span>
          <span>执行中</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#f87171' }}></span>
          <span>失败</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#9ca3af' }}></span>
          <span>待处理</span>
        </div>
      </div>
    </div>
  );
};
