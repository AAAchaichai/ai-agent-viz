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

  // 角色差异化配置
  private agentStyles: Record<string, { glowColor: string; decorations: string[] }> = {
    '海绵宝宝': { glowColor: '#FFD93D', decorations: ['star'] },
    '派大星': { glowColor: '#FF8FAB', decorations: ['circle'] },
    '章鱼哥': { glowColor: '#6BC1FF', decorations: ['square'] }
  };

  // 状态对应的颜色配置
  private stateColors: Record<AgentState, { main: string; shadow: string; highlight: string; glow: string }> = {
    idle: { main: '#9CA3AF', shadow: '#6B7280', highlight: '#D1D5DB', glow: 'rgba(156, 163, 175, 0.4)' },
    thinking: { main: '#FFD93D', shadow: '#CCAA00', highlight: '#FFEE88', glow: 'rgba(255, 217, 61, 0.6)' },
    typing: { main: '#6BCF7F', shadow: '#4AA55D', highlight: '#8EE5A0', glow: 'rgba(107, 207, 127, 0.6)' },
    error: { main: '#FF6B6B', shadow: '#CC4444', highlight: '#FF9999', glow: 'rgba(255, 107, 107, 0.8)' },
    success: { main: '#4DABF7', shadow: '#2E8AD4', highlight: '#7AC4FF', glow: 'rgba(77, 171, 247, 0.5)' }
  };

  // 状态图标配置
  private stateIcons: Record<AgentState, string> = {
    idle: '💤',
    thinking: '💭',
    typing: '⌨️',
    error: '⚠️',
    success: '✨'
  };

  // 渲染 Agent
  render(ctx: RenderContext, agent: Agent, isSelected: boolean = false) {
    const { ctx: canvasCtx } = ctx;
    const x = agent.position.x;
    const y = agent.position.y;
    const size = this.AGENT_SIZE * this.SCALE;

    canvasCtx.save();

    // 更新动画帧
    this.updateAnimation();

    // 如果选择，绘制选中框
    if (isSelected) {
      this.renderSelectionBox(canvasCtx, x, y, size);
    }

    // 根据状态绘制不同动画
    this.renderAgentBody(canvasCtx, x, y, agent.state, agent.name, isSelected);

    canvasCtx.restore();
  }

  // 绘制选中框
  private renderSelectionBox(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x - size/2 - 5, y - size/2 - 5, size + 10, size + 10);
    ctx.setLineDash([]);

    // 像素风格角落装饰
    ctx.fillStyle = '#FFFFFF';
    const cornerSize = 6;
    // 四个角
    ctx.fillRect(x - size/2 - 5, y - size/2 - 5, cornerSize, 2);
    ctx.fillRect(x - size/2 - 5, y - size/2 - 5, 2, cornerSize);
    ctx.fillRect(x + size/2 + 5 - cornerSize, y - size/2 - 5, cornerSize, 2);
    ctx.fillRect(x + size/2 + 5 - 2, y - size/2 - 5, 2, cornerSize);
    ctx.fillRect(x - size/2 - 5, y + size/2 + 5 - 2, cornerSize, 2);
    ctx.fillRect(x - size/2 - 5, y + size/2 + 5 - cornerSize, 2, cornerSize);
    ctx.fillRect(x + size/2 + 5 - cornerSize, y + size/2 + 5 - 2, cornerSize, 2);
    ctx.fillRect(x + size/2 + 5 - 2, y + size/2 + 5 - cornerSize, 2, cornerSize);
    ctx.restore();
  }

  // 渲染 Agent 身体（像素艺术风格）
  private renderAgentBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    state: AgentState,
    name: string,
    isSelected: boolean = false
  ) {
    const size = this.AGENT_SIZE * this.SCALE;
    const halfSize = size / 2;
    const colors = this.stateColors[state];
    const agentStyle = this.agentStyles[name] || { glowColor: colors.glow, decorations: [] };

    // 计算动画效果
    const bounce = this.getBounceOffset(state);
    const scale = this.getScaleEffect(state);
    const shake = this.getShakeEffect(state);

    // 应用变换
    ctx.save();
    ctx.translate(x + shake, y);
    ctx.scale(scale, scale);
    ctx.translate(0, bounce);

    // 绘制底部阴影（增加立体感）
    this.renderShadow(ctx, 0, halfSize + 8, halfSize * 0.8);

    // 绘制状态光晕
    this.renderGlow(ctx, 0, 0, halfSize + 10, state, agentStyle.glowColor);

    // 绘制像素角色主体
    this.renderPixelBody(ctx, 0, 0, state, colors, agentStyle.decorations);

    ctx.restore();

    // 绘制名字（不受动画影响）
    this.renderName(ctx, x, y + halfSize + 25, name, isSelected);

    // 绘制状态指示器
    this.renderStateIndicator(ctx, x + halfSize - 8, y - halfSize + 8, state);
  }

  // 绘制底部阴影
  private renderShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    // 主阴影
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 硬阴影（像素风格）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, radius * 0.8, radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 绘制状态光晕
  private renderGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    state: AgentState,
    customGlowColor?: string
  ) {
    const colors = this.stateColors[state];
    const glowColor = customGlowColor || colors.glow;

    // 脉冲效果
    let pulseIntensity = 0.6;
    let pulseScale = 1;

    if (state === 'thinking') {
      // 思考时快速脉冲
      pulseIntensity = 0.4 + (Math.sin(this.animationFrame * 0.3) + 1) * 0.3;
      pulseScale = 1 + (Math.sin(this.animationFrame * 0.3) * 0.1);
    } else if (state === 'typing') {
      // 打字时流光效果
      pulseIntensity = 0.5 + (Math.sin(this.animationFrame * 0.5) + 1) * 0.2;
    } else if (state === 'error') {
      // 错误时闪烁
      pulseIntensity = 0.4 + (Math.random() * 0.4);
    } else if (state === 'idle') {
      // idle 时微光呼吸
      pulseIntensity = 0.2 + (Math.sin(this.animationFrame * 0.1) + 1) * 0.15;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulseScale, pulseScale);

    // 外层光晕
    const outerGradient = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius);
    outerGradient.addColorStop(0, glowColor.replace(/[\d.]+\)$/, `${pulseIntensity})`));
    outerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 内层光晕
    const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.6);
    innerGradient.addColorStop(0, glowColor.replace(/[\d.]+\)$/, `${pulseIntensity * 0.8})`));
    innerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 绘制像素身体主体
  private renderPixelBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    state: AgentState,
    colors: { main: string; shadow: string; highlight: string },
    decorations: string[]
  ) {
    const pixelSize = 4 * this.SCALE;
    const bodyX = x - pixelSize * 3;
    const bodyY = y - pixelSize * 4;

    // 绘制像素风格边框（2-3px深色边框）
    const borderColor = '#1F2937';
    const borderWidth = 2;

    // 头部边框
    this.drawPixelRectWithBorder(ctx, bodyX, bodyY, pixelSize * 6, pixelSize * 5, colors.main, borderColor, borderWidth);

    // 身体边框
    this.drawPixelRectWithBorder(ctx, bodyX + pixelSize, bodyY + pixelSize * 5, pixelSize * 4, pixelSize * 4, colors.shadow, borderColor, borderWidth);

    // 绘制眼睛（白色底 + 黑色瞳孔）
    const eyeY = bodyY + pixelSize * 2;
    const pupilOffset = this.getPupilOffset(state);

    // 左眼
    this.drawPixelRectWithBorder(ctx, bodyX + pixelSize, eyeY, pixelSize * 2, pixelSize, '#FFFFFF', borderColor, 1);
    this.drawPixelRect(ctx, bodyX + pixelSize + 4 + pupilOffset, eyeY + 2, pixelSize - 4, pixelSize - 4, '#000000');

    // 右眼
    this.drawPixelRectWithBorder(ctx, bodyX + pixelSize * 3.5, eyeY, pixelSize * 2, pixelSize, '#FFFFFF', borderColor, 1);
    this.drawPixelRect(ctx, bodyX + pixelSize * 3.5 + 4 + pupilOffset, eyeY + 2, pixelSize - 4, pixelSize - 4, '#000000');

    // 绘制手臂
    const armOffset = this.getArmOffset(state);
    const armColor = colors.highlight;

    // 左臂
    this.drawPixelRectWithBorder(ctx, bodyX - pixelSize, bodyY + pixelSize * 5 + armOffset, pixelSize, pixelSize * 2.5, armColor, borderColor, 1);
    // 右臂
    this.drawPixelRectWithBorder(ctx, bodyX + pixelSize * 6, bodyY + pixelSize * 5 - armOffset, pixelSize, pixelSize * 2.5, armColor, borderColor, 1);

    // 绘制腿部
    // 左腿
    this.drawPixelRectWithBorder(ctx, bodyX + pixelSize * 1.5, bodyY + pixelSize * 9, pixelSize, pixelSize * 1.5, colors.shadow, borderColor, 1);
    // 右腿
    this.drawPixelRectWithBorder(ctx, bodyX + pixelSize * 4.5, bodyY + pixelSize * 9, pixelSize, pixelSize * 1.5, colors.shadow, borderColor, 1);

    // 头顶高光点（像素艺术常见技巧）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(bodyX + pixelSize * 1.5, bodyY + pixelSize * 0.5, 4, 4);
    ctx.fillRect(bodyX + pixelSize * 1.5 + 4, bodyY + pixelSize * 0.5, 2, 2);

    // 角色差异化装饰
    this.renderDecorations(ctx, bodyX, bodyY, pixelSize, decorations, colors);
  }

  // 绘制带边框的像素矩形
  private drawPixelRectWithBorder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: string,
    borderColor: string,
    borderWidth: number
  ) {
    // 绘制边框
    ctx.fillStyle = borderColor;
    ctx.fillRect(x - borderWidth, y - borderWidth, width + borderWidth * 2, height + borderWidth * 2);

    // 绘制填充
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width, height);
  }

  // 绘制像素矩形
  private drawPixelRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  // 绘制角色装饰
  private renderDecorations(
    ctx: CanvasRenderingContext2D,
    bodyX: number,
    bodyY: number,
    pixelSize: number,
    decorations: string[],
    _colors: { main: string; shadow: string; highlight: string }
  ) {
    decorations.forEach((decoration, index) => {
      const offsetX = index * 8;
      switch (decoration) {
        case 'star':
          // 星星装饰 - 海绵宝宝
          this.drawPixelStar(ctx, bodyX + pixelSize * 6 + 4 + offsetX, bodyY + pixelSize * 2, 6, '#FFD93D');
          break;
        case 'circle':
          // 圆形装饰 - 派大星
          ctx.fillStyle = '#FF8FAB';
          ctx.beginPath();
          ctx.arc(bodyX + pixelSize * 6 + 8, bodyY + pixelSize * 2, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1F2937';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        case 'square':
          // 方形装饰 - 章鱼哥
          ctx.fillStyle = '#6BC1FF';
          ctx.fillRect(bodyX + pixelSize * 6 + 4 + offsetX, bodyY + pixelSize * 1.5, 6, 6);
          ctx.strokeStyle = '#1F2937';
          ctx.lineWidth = 1;
          ctx.strokeRect(bodyX + pixelSize * 6 + 4 + offsetX, bodyY + pixelSize * 1.5, 6, 6);
          break;
      }
    });
  }

  // 绘制像素星星
  private drawPixelStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 1;

    // 简单的像素星星
    const starPixels = [
      { dx: 0, dy: -size/2, w: 2, h: 2 },
      { dx: size/3, dy: -size/4, w: 2, h: 2 },
      { dx: size/2, dy: 0, w: 2, h: 2 },
      { dx: size/3, dy: size/4, w: 2, h: 2 },
      { dx: 0, dy: size/2, w: 2, h: 2 },
      { dx: -size/3, dy: size/4, w: 2, h: 2 },
      { dx: -size/2, dy: 0, w: 2, h: 2 },
      { dx: -size/3, dy: -size/4, w: 2, h: 2 },
    ];

    starPixels.forEach(p => {
      ctx.fillRect(x + p.dx, y + p.dy, p.w, p.h);
    });
  }

  // 渲染名字
  private renderName(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, isSelected: boolean) {
    // 名字背景
    const textWidth = ctx.measureText(name).width + 16;
    const bgHeight = 20;

    ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.9)' : 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x - textWidth/2, y - bgHeight/2 - 2, textWidth, bgHeight, 4);
    ctx.fill();

    // 名字文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px "Press Start 2P", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, y + 1);
  }

  // 渲染状态指示器
  private renderStateIndicator(ctx: CanvasRenderingContext2D, x: number, y: number, state: AgentState) {
    const icon = this.stateIcons[state];
    const colors = this.stateColors[state];

    ctx.save();

    // 绘制图标背景
    const bgSize = 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x - bgSize/2, y - bgSize/2, bgSize, bgSize, 4);
    ctx.fill();

    // 绘制边框
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - bgSize/2, y - bgSize/2, bgSize, bgSize, 4);
    ctx.stroke();

    // 绘制图标
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y + 1);

    // 状态闪烁效果
    if (state !== 'idle') {
      const pulse = (Math.sin(this.animationFrame * 0.1) + 1) / 2;
      ctx.fillStyle = colors.glow.replace(/[\d.]+\)$/, `${pulse * 0.6})`);
      ctx.beginPath();
      ctx.arc(x, y, bgSize/2 + 2 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 更新动画
  private updateAnimation() {
    const now = Date.now();
    if (now - this.lastUpdate > 50) { // 每50ms更新一帧（更流畅）
      this.animationFrame++;
      this.lastUpdate = now;
    }
  }

  // 获取弹跳偏移（呼吸效果）
  private getBounceOffset(state: AgentState): number {
    const time = this.animationFrame * 0.1;

    switch (state) {
      case 'thinking':
        // 思考时快速弹跳 + 头部晃动
        return Math.sin(this.animationFrame * 0.3) * 4 + Math.sin(this.animationFrame * 0.15) * 2;
      case 'typing':
        // 打字时轻微抖动
        return Math.sin(this.animationFrame * 0.5) * 1.5 + (Math.random() - 0.5) * 0.5;
      case 'error':
        // 错误时剧烈抖动
        return (Math.random() - 0.5) * 6;
      case 'success':
        // 成功时欢快弹跳
        return Math.abs(Math.sin(this.animationFrame * 0.2)) * 5;
      default:
        // idle 时缓慢呼吸（上下浮动）
        return Math.sin(time) * 2;
    }
  }

  // 获取缩放效果（呼吸）
  private getScaleEffect(state: AgentState): number {
    const time = this.animationFrame * 0.08;

    switch (state) {
      case 'idle':
        // idle 时呼吸效果
        return 1 + Math.sin(time) * 0.03;
      case 'thinking':
        // 思考时快速呼吸
        return 1 + Math.sin(this.animationFrame * 0.25) * 0.05;
      case 'typing':
        // 打字时轻微缩放
        return 1 + Math.sin(this.animationFrame * 0.4) * 0.02;
      case 'error':
        // 错误时闪烁缩放
        return 1 + (Math.random() - 0.5) * 0.05;
      default:
        return 1;
    }
  }

  // 获取抖动效果
  private getShakeEffect(state: AgentState): number {
    if (state === 'error') {
      return (Math.random() - 0.5) * 3;
    }
    return 0;
  }

  // 获取手臂偏移
  private getArmOffset(state: AgentState): number {
    switch (state) {
      case 'thinking':
        // 思考时挥手
        return Math.sin(this.animationFrame * 0.2) * 4;
      case 'typing':
        // 打字时快速挥动（手臂挥动示意）
        return Math.sin(this.animationFrame * 0.8) * 3;
      default:
        // 默认缓慢摆动
        return Math.sin(this.animationFrame * 0.1) * 1;
    }
  }

  // 获取瞳孔偏移
  private getPupilOffset(state: AgentState): number {
    switch (state) {
      case 'thinking':
        // 思考时看向上方（略微偏移）
        return Math.sin(this.animationFrame * 0.1) * 1;
      case 'typing':
        // 打字时快速移动
        return Math.sin(this.animationFrame * 0.5) * 2;
      default:
        return Math.sin(this.animationFrame * 0.05) * 1;
    }
  }
}
