import type { AgentState } from '../types';
import type { RenderContext } from './CanvasEngine';

export class ThoughtBubbleRenderer {
  private animationFrame: number = 0;
  private lastUpdate: number = Date.now();
  private dots: number = 0;
  private typingText: string = '';
  private targetText: string = '';
  private typingIndex: number = 0;
  private lastTypeTime: number = 0;

  // 渲染思维气泡
  render(
    ctx: RenderContext, 
    x: number, 
    y: number, 
    state: AgentState,
    message?: string
  ) {
    const { ctx: canvasCtx } = ctx;
    
    this.updateAnimation();
    
    // 根据状态决定是否显示气泡
    if (state === 'idle') return;
    
    canvasCtx.save();
    
    // 计算气泡位置（在角色上方）
    const bubbleX = x;
    const bubbleY = y - 70;
    
    switch (state) {
      case 'thinking':
        this.renderThinkingBubble(canvasCtx, bubbleX, bubbleY);
        break;
      case 'typing':
        this.renderTypingBubble(canvasCtx, bubbleX, bubbleY, message);
        break;
      case 'error':
        this.renderErrorBubble(canvasCtx, bubbleX, bubbleY);
        break;
      case 'success':
        this.renderSuccessBubble(canvasCtx, bubbleX, bubbleY);
        break;
    }
    
    canvasCtx.restore();
  }

  // 思考气泡 (...)
  private renderThinkingBubble(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bubbleWidth = 60;
    const bubbleHeight = 40;
    
    // 绘制气泡背景
    this.drawBubbleBackground(ctx, x, y, bubbleWidth, bubbleHeight, '#FFF8DC');
    
    // 绘制思考的省略号动画
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 动态显示 1-3 个点
    const dotsCount = Math.floor(this.dots) + 1;
    const dotsText = '.'.repeat(dotsCount);
    ctx.fillText(dotsText, x, y);
    
    // 绘制小思考圆圈
    this.drawThoughtCircles(ctx, x, y + bubbleHeight/2 + 10);
  }

  // 打字气泡
  private renderTypingBubble(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number,
    message?: string
  ) {
    const maxWidth = 200;
    const padding = 10;
    
    // 更新打字动画
    if (message && message !== this.targetText) {
      this.targetText = message;
      this.typingIndex = 0;
      this.typingText = '';
    }
    
    // 逐字显示
    const now = Date.now();
    if (now - this.lastTypeTime > 50 && this.typingIndex < this.targetText.length) {
      this.typingText = this.targetText.substring(0, this.typingIndex + 1);
      this.typingIndex++;
      this.lastTypeTime = now;
    }
    
    // 计算文字尺寸
    ctx.font = '12px monospace';
    const displayText = this.typingText || '...';
    const lines = this.wrapText(ctx, displayText, maxWidth - padding * 2);
    const lineHeight = 16;
    const bubbleHeight = Math.max(40, lines.length * lineHeight + padding * 2);
    const bubbleWidth = Math.min(maxWidth, ctx.measureText(displayText).width + padding * 2);
    
    // 绘制气泡背景
    this.drawBubbleBackground(ctx, x, y, bubbleWidth, bubbleHeight, '#E8F5E9');
    
    // 绘制文字
    ctx.fillStyle = '#2E7D32';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const startX = x - bubbleWidth / 2 + padding;
    const startY = y - bubbleHeight / 2 + padding;
    
    lines.forEach((line, index) => {
      ctx.fillText(line, startX, startY + index * lineHeight);
    });
    
    // 绘制光标
    if (Math.floor(this.animationFrame / 5) % 2 === 0) {
      const lastLine = lines[lines.length - 1] || '';
      const cursorX = startX + ctx.measureText(lastLine).width;
      const cursorY = startY + (lines.length - 1) * lineHeight;
      ctx.fillStyle = '#2E7D32';
      ctx.fillRect(cursorX, cursorY, 2, 12);
    }
  }

  // 错误气泡
  private renderErrorBubble(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bubbleWidth = 50;
    const bubbleHeight = 50;
    
    // 绘制气泡背景（红色）
    this.drawBubbleBackground(ctx, x, y, bubbleWidth, bubbleHeight, '#FFEBEE');
    
    // 绘制错误图标
    ctx.strokeStyle = '#D32F2F';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    const size = 15;
    // X 形状
    ctx.beginPath();
    ctx.moveTo(x - size/2, y - size/2);
    ctx.lineTo(x + size/2, y + size/2);
    ctx.moveTo(x + size/2, y - size/2);
    ctx.lineTo(x - size/2, y + size/2);
    ctx.stroke();
    
    // 抖动效果
    const shakeX = (Math.random() - 0.5) * 2;
    const shakeY = (Math.random() - 0.5) * 2;
    
    // 重绘带抖动
    ctx.strokeStyle = '#D32F2F';
    ctx.beginPath();
    ctx.moveTo(x - size/2 + shakeX, y - size/2 + shakeY);
    ctx.lineTo(x + size/2 + shakeX, y + size/2 + shakeY);
    ctx.moveTo(x + size/2 + shakeX, y - size/2 + shakeY);
    ctx.lineTo(x - size/2 + shakeX, y + size/2 + shakeY);
    ctx.stroke();
  }

  // 成功气泡
  private renderSuccessBubble(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bubbleWidth = 50;
    const bubbleHeight = 50;
    
    // 绘制气泡背景（绿色）
    this.drawBubbleBackground(ctx, x, y, bubbleWidth, bubbleHeight, '#E8F5E9');
    
    // 绘制对勾
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const size = 12;
    ctx.beginPath();
    ctx.moveTo(x - size/2, y);
    ctx.lineTo(x - size/4, y + size/2);
    ctx.lineTo(x + size/2, y - size/3);
    ctx.stroke();
  }

  // 绘制气泡背景
  private drawBubbleBackground(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ) {
    const cornerRadius = 10;
    const tailHeight = 10;
    
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    
    // 绘制圆角矩形带小尾巴
    ctx.beginPath();
    
    // 左上角
    ctx.moveTo(x - width/2 + cornerRadius, y - height/2);
    // 右上角
    ctx.lineTo(x + width/2 - cornerRadius, y - height/2);
    ctx.quadraticCurveTo(x + width/2, y - height/2, x + width/2, y - height/2 + cornerRadius);
    // 右下（尾巴左侧）
    ctx.lineTo(x + width/2, y + height/2 - cornerRadius);
    ctx.quadraticCurveTo(x + width/2, y + height/2, x + width/2 - cornerRadius, y + height/2);
    // 尾巴
    ctx.lineTo(x + 5, y + height/2);
    ctx.lineTo(x, y + height/2 + tailHeight);
    ctx.lineTo(x - 5, y + height/2);
    // 左下
    ctx.lineTo(x - width/2 + cornerRadius, y + height/2);
    ctx.quadraticCurveTo(x - width/2, y + height/2, x - width/2, y + height/2 - cornerRadius);
    // 左上
    ctx.lineTo(x - width/2, y - height/2 + cornerRadius);
    ctx.quadraticCurveTo(x - width/2, y - height/2, x - width/2 + cornerRadius, y - height/2);
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // 内部高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x - width/4, y - height/4, width/6, height/8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 绘制思考圆圈
  private drawThoughtCircles(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const circles = [
      { x: 0, y: 0, r: 4 },
      { x: -8, y: 8, r: 3 },
      { x: -15, y: 18, r: 2 }
    ];
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    circles.forEach(circle => {
      ctx.beginPath();
      ctx.arc(x + circle.x, y + circle.y, circle.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 文字换行
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    lines.push(currentLine);
    return lines;
  }

  // 更新动画
  private updateAnimation() {
    const now = Date.now();
    if (now - this.lastUpdate > 200) {
      this.animationFrame++;
      this.dots = (this.dots + 0.5) % 3;
      this.lastUpdate = now;
    }
  }
}
