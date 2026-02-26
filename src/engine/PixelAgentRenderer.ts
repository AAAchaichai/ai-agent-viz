import type { Agent } from '../store/agentStore';
import type { AgentState } from '../types';
import type { RenderContext } from './CanvasEngine';

export class PixelAgentRenderer {
  // 像素角色尺寸
  private readonly AGENT_SIZE = 32;
  private readonly SCALE = 2;
  
  // 动画计时器
  private animationFrame: number = 0;
  private lastUpdate: number = Date.now();
  
  // 状态对应的颜色配置
  private stateColors: Record<AgentState, { main: string; shadow: string; highlight: string }> = {
    idle: { main: '#888888', shadow: '#666666', highlight: '#AAAAAA' },
    thinking: { main: '#FFD93D', shadow: '#CCAA00', highlight: '#FFEE88' },
    typing: { main: '#6BCF7F', shadow: '#4AA55D', highlight: '#8EE5A0' },
    error: { main: '#FF6B6B', shadow: '#CC4444', highlight: '#FF9999' },
    success: { main: '#4DABF7', shadow: '#2E8AD4', highlight: '#7AC4FF' }
  };

  // 渲染 Agent
  render(ctx: RenderContext, agent: Agent, isSelected: boolean = false) {
    const { ctx: canvasCtx } = ctx;
    const x = agent.position.x;
    const y = agent.position.y;
    const size = this.AGENT_SIZE * this.SCALE;
    
    canvasCtx.save();
    
    // 如果选择，绘制选中框
    if (isSelected) {
      canvasCtx.strokeStyle = '#FFFFFF';
      canvasCtx.lineWidth = 2;
      canvasCtx.setLineDash([5, 5]);
      canvasCtx.strokeRect(x - size/2 - 5, y - size/2 - 5, size + 10, size + 10);
      canvasCtx.setLineDash([]);
    }
    
    // 根据状态绘制不同动画
    this.renderAgentBody(canvasCtx, x, y, agent.state, agent.name);
    
    canvasCtx.restore();
  }

  // 渲染 Agent 身体（像素风格）
  private renderAgentBody(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    state: AgentState,
    name: string
  ) {
    const size = this.AGENT_SIZE * this.SCALE;
    const halfSize = size / 2;
    const colors = this.stateColors[state];
    
    // 更新动画帧
    this.updateAnimation();
    
    // 绘制阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + halfSize + 5, halfSize * 0.8, halfSize * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制像素角色（使用简单的几何形状组合）
    const pixelSize = 4 * this.SCALE;
    const bodyX = x - halfSize;
    const bodyY = y - halfSize;
    
    // 根据状态绘制不同动画帧
    const bounce = this.getBounceOffset(state);
    
    // 绘制像素块组成的角色
    ctx.fillStyle = colors.main;
    
    // 头部 (4x4 像素块)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const px = bodyX + col * pixelSize + pixelSize;
        const py = bodyY + row * pixelSize + bounce;
        ctx.fillRect(px, py, pixelSize, pixelSize);
      }
    }
    
    // 眼睛 (2x1 像素块)
    ctx.fillStyle = '#FFFFFF';
    const eyeY = bodyY + pixelSize + 4 + bounce;
    ctx.fillRect(bodyX + pixelSize * 1.5, eyeY, pixelSize, pixelSize / 2);
    ctx.fillRect(bodyX + pixelSize * 3.5, eyeY, pixelSize, pixelSize / 2);
    
    // 瞳孔
    ctx.fillStyle = '#000000';
    const pupilY = eyeY + 2;
    const pupilOffset = this.getPupilOffset(state);
    ctx.fillRect(bodyX + pixelSize * 1.5 + 4 + pupilOffset, pupilY, pixelSize / 2, pixelSize / 2);
    ctx.fillRect(bodyX + pixelSize * 3.5 + 4 + pupilOffset, pupilY, pixelSize / 2, pixelSize / 2);
    
    // 身体 (3x3 像素块)
    ctx.fillStyle = colors.shadow;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const px = bodyX + col * pixelSize + pixelSize * 1.5;
        const py = bodyY + pixelSize * 4 + row * pixelSize + bounce;
        ctx.fillRect(px, py, pixelSize, pixelSize);
      }
    }
    
    // 手臂（根据状态动画）
    const armOffset = this.getArmOffset(state);
    ctx.fillStyle = colors.highlight;
    // 左臂
    ctx.fillRect(bodyX + pixelSize * 0.5, bodyY + pixelSize * 4.5 + armOffset + bounce, pixelSize, pixelSize * 2);
    // 右臂
    ctx.fillRect(bodyX + pixelSize * 5.5, bodyY + pixelSize * 4.5 - armOffset + bounce, pixelSize, pixelSize * 2);
    
    // 腿部
    ctx.fillStyle = colors.shadow;
    // 左腿
    ctx.fillRect(bodyX + pixelSize * 2, bodyY + pixelSize * 7 + bounce, pixelSize, pixelSize * 1.5);
    // 右腿
    ctx.fillRect(bodyX + pixelSize * 4, bodyY + pixelSize * 7 + bounce, pixelSize, pixelSize * 1.5);
    
    // 绘制名字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(name, x, y + halfSize + 20);
    
    // 绘制状态指示器（小圆点）
    ctx.fillStyle = colors.main;
    ctx.beginPath();
    ctx.arc(x + halfSize - 5, y - halfSize + 5, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 状态闪烁效果
    if (state !== 'idle') {
      const pulse = (Math.sin(this.animationFrame * 0.1) + 1) / 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
      ctx.beginPath();
      ctx.arc(x + halfSize - 5, y - halfSize + 5, 4 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 更新动画
  private updateAnimation() {
    const now = Date.now();
    if (now - this.lastUpdate > 100) { // 每100ms更新一帧
      this.animationFrame++;
      this.lastUpdate = now;
    }
  }

  // 获取弹跳偏移（呼吸效果）
  private getBounceOffset(state: AgentState): number {
    const baseBounce = Math.sin(this.animationFrame * 0.1) * 2;
    
    switch (state) {
      case 'thinking':
        // 思考时快速弹跳
        return Math.sin(this.animationFrame * 0.3) * 3;
      case 'typing':
        // 打字时轻微抖动
        return Math.sin(this.animationFrame * 0.5) * 1.5;
      case 'error':
        // 错误时抖动
        return (Math.random() - 0.5) * 4;
      case 'success':
        // 成功时欢快弹跳
        return Math.abs(Math.sin(this.animationFrame * 0.2)) * 4;
      default:
        // idle 时缓慢呼吸
        return baseBounce;
    }
  }

  // 获取手臂偏移
  private getArmOffset(state: AgentState): number {
    switch (state) {
      case 'thinking':
        return Math.sin(this.animationFrame * 0.2) * 3;
      case 'typing':
        return Math.sin(this.animationFrame * 0.8) * 2;
      default:
        return Math.sin(this.animationFrame * 0.1) * 1;
    }
  }

  // 获取瞳孔偏移
  private getPupilOffset(state: AgentState): number {
    switch (state) {
      case 'thinking':
        // 思考时看向上方
        return 0;
      case 'typing':
        // 打字时快速移动
        return Math.sin(this.animationFrame * 0.5) * 2;
      default:
        return Math.sin(this.animationFrame * 0.05) * 1;
    }
  }
}
