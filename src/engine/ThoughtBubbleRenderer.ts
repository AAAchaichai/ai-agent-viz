import type { AgentState } from '../types';
import type { RenderContext } from './CanvasEngine';

export class ThoughtBubbleRenderer {
  private animationFrame: number = 0;
  private lastUpdate: number = Date.now();
  private dots: number = 0;
  private dotsDirection: number = 1;
  private typingText: string = '';
  private targetText: string = '';
  private typingIndex: number = 0;
  private lastTypeTime: number = 0;

  // 状态对应的气泡颜色配置
  private bubbleColors: Record<AgentState, { bg: string; border: string; text: string; gradient: string[] }> = {
    idle: { bg: '#F3F4F6', border: '#9CA3AF', text: '#4B5563', gradient: ['#F9FAFB', '#F3F4F6'] },
    thinking: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', gradient: ['#FFFBEB', '#FEF3C7'] },
    typing: { bg: '#D1FAE5', border: '#10B981', text: '#065F46', gradient: ['#ECFDF5', '#D1FAE5'] },
    error: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B', gradient: ['#FEF2F2', '#FEE2E2'] },
    success: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF', gradient: ['#EFF6FF', '#DBEAFE'] }
  };

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
    const bubbleY = y - 80;

    switch (state) {
      case 'thinking':
        this.renderThinkingBubble(canvasCtx, bubbleX, bubbleY);
        break;
      case 'typing':
        this.renderTypingBubble(canvasCtx, bubbleX, bubbleY, message);
        break;
      case 'error':
        this.renderErrorBubble(canvasCtx, bubbleX, bubbleY, message);
        break;
      case 'success':
        this.renderSuccessBubble(canvasCtx, bubbleX, bubbleY);
        break;
    }

    canvasCtx.restore();
  }

  // 思考气泡 (💭 思维气泡)
  private renderThinkingBubble(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bubbleWidth = 70;
    const bubbleHeight = 45;
    const colors = this.bubbleColors.thinking;

    // 绘制像素风格气泡背景
    this.drawPixelBubbleBackground(ctx, x, y, bubbleWidth, bubbleHeight, colors);

    // 绘制思考的思维气泡图标
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.text;
    ctx.fillText('💭', x, y);

    // 绘制动态省略号
    this.renderAnimatedDots(ctx, x, y + 18, colors.text);

    // 绘制小思考圆圈（像素风格）
    this.drawThoughtCircles(ctx, x, y + bubbleHeight/2 + 15);
  }

  // 打字气泡
  private renderTypingBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    message?: string
  ) {
    const maxWidth = 220;
    const padding = 14;
    const colors = this.bubbleColors.typing;

    // 更新打字动画
    if (message && message !== this.targetText) {
      this.targetText = message;
      this.typingIndex = 0;
      this.typingText = '';
    }

    // 逐字显示（动态打字效果）
    const now = Date.now();
    if (now - this.lastTypeTime > 30 && this.typingIndex < this.targetText.length) {
      this.typingText = this.targetText.substring(0, this.typingIndex + 1);
      this.typingIndex++;
      this.lastTypeTime = now;
    }

    // 计算文字尺寸
    ctx.font = '12px "Press Start 2P", monospace, sans-serif';
    const displayText = this.typingText || '...';
    const lines = this.wrapText(ctx, displayText, maxWidth - padding * 2);
    const lineHeight = 16;
    const bubbleHeight = Math.max(50, lines.length * lineHeight + padding * 2);
    const bubbleWidth = Math.min(maxWidth, this.getMaxLineWidth(ctx, lines) + padding * 2);

    // 绘制像素风格气泡背景
    this.drawPixelBubbleBackground(ctx, x, y, bubbleWidth, bubbleHeight, colors);

    // 绘制键盘图标
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⌨️', x - bubbleWidth/2 + 10, y - bubbleHeight/2 + 10);

    // 绘制文字
    ctx.fillStyle = colors.text;
    ctx.font = '12px "Press Start 2P", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const startX = x - bubbleWidth / 2 + padding;
    const startY = y - bubbleHeight / 2 + padding + (lines.length > 1 ? 0 : 8);

    lines.forEach((line, index) => {
      ctx.fillText(line, startX, startY + index * lineHeight);
    });

    // 绘制闪烁光标
    if (Math.floor(this.animationFrame / 8) % 2 === 0 && this.typingIndex < this.targetText.length) {
      const lastLine = lines[lines.length - 1] || '';
      const cursorX = startX + ctx.measureText(lastLine).width;
      const cursorY = startY + (lines.length - 1) * lineHeight;
      ctx.fillStyle = colors.text;
      ctx.fillRect(cursorX + 2, cursorY, 2, 12);
    }

    // 绘制打字动画指示器
    this.renderTypingIndicator(ctx, x + bubbleWidth/2 - 20, y + bubbleHeight/2 - 12);
  }

  // 错误气泡
  private renderErrorBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    message?: string
  ) {
    const bubbleWidth = message ? Math.min(200, message.length * 10 + 40) : 60;
    const bubbleHeight = message ? 70 : 55;
    const colors = this.bubbleColors.error;

    // 绘制像素风格气泡背景
    this.drawPixelBubbleBackground(ctx, x, y, bubbleWidth, bubbleHeight, colors);

    // 绘制警告图标 ⚠️
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.text;
    ctx.fillText('⚠️', x, message ? y - 15 : y);

    // 绘制错误文字
    if (message) {
      ctx.font = '10px "Press Start 2P", monospace, sans-serif';
      ctx.fillStyle = colors.text;
      const lines = this.wrapText(ctx, message, bubbleWidth - 20);
      lines.forEach((line, index) => {
        ctx.fillText(line, x, y + 10 + index * 14);
      });
    }

    // 抖动效果（红色警告闪烁）
    const shakeX = (Math.random() - 0.5) * 3;
    const shakeY = (Math.random() - 0.5) * 3;

    // 红色闪烁边框
    if (Math.floor(this.animationFrame / 4) % 2 === 0) {
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - bubbleWidth/2 + shakeX, y - bubbleHeight/2 + shakeY, bubbleWidth, bubbleHeight);
    }
  }

  // 成功气泡
  private renderSuccessBubble(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bubbleWidth = 60;
    const bubbleHeight = 55;
    const colors = this.bubbleColors.success;

    // 绘制像素风格气泡背景
    this.drawPixelBubbleBackground(ctx, x, y, bubbleWidth, bubbleHeight, colors);

    // 绘制对勾 ✓
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.text;
    ctx.fillText('✓', x, y);

    // 闪光效果
    if (this.animationFrame % 20 < 10) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(x - bubbleWidth/2 + 5, y - bubbleHeight/2 + 5, 8, 8);
    }
  }

  // 绘制像素风格气泡背景
  private drawPixelBubbleBackground(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    colors: { bg: string; border: string; gradient: string[] }
  ) {
    const tailHeight = 12;
    const tailWidth = 16;
    const cornerSize = 8;

    // 计算气泡位置（确保不超出边界）
    const bubbleX = x - width / 2;
    const bubbleY = y - height / 2;

    // 绘制渐变背景
    const gradient = ctx.createLinearGradient(bubbleX, bubbleY, bubbleX, bubbleY + height);
    gradient.addColorStop(0, colors.gradient[0]);
    gradient.addColorStop(1, colors.gradient[1]);

    // 绘制像素风格气泡主体
    ctx.fillStyle = gradient;

    // 主体矩形
    ctx.fillRect(bubbleX + cornerSize, bubbleY, width - cornerSize * 2, height);
    ctx.fillRect(bubbleX, bubbleY + cornerSize, width, height - cornerSize * 2);

    // 圆角（像素风格）
    ctx.fillRect(bubbleX + cornerSize, bubbleY, width - cornerSize * 2, cornerSize);
    ctx.fillRect(bubbleX + cornerSize, bubbleY + height - cornerSize, width - cornerSize * 2, cornerSize);

    // 四个圆角像素块
    this.drawPixelCorner(ctx, bubbleX, bubbleY, cornerSize, 'tl');
    this.drawPixelCorner(ctx, bubbleX + width - cornerSize, bubbleY, cornerSize, 'tr');
    this.drawPixelCorner(ctx, bubbleX, bubbleY + height - cornerSize, cornerSize, 'bl');
    this.drawPixelCorner(ctx, bubbleX + width - cornerSize, bubbleY + height - cornerSize, cornerSize, 'br');

    // 绘制尾巴（像素风格）
    this.drawPixelTail(ctx, x, bubbleY + height, tailWidth, tailHeight, gradient);

    // 绘制像素风格边框（2px粗）
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;

    // 上边框
    ctx.strokeRect(bubbleX + cornerSize, bubbleY, width - cornerSize * 2, 2);
    // 下边框
    ctx.strokeRect(bubbleX + cornerSize, bubbleY + height - 2, width - cornerSize * 2, 2);
    // 左边框
    ctx.strokeRect(bubbleX, bubbleY + cornerSize, 2, height - cornerSize * 2);
    // 右边框
    ctx.strokeRect(bubbleX + width - 2, bubbleY + cornerSize, 2, height - cornerSize * 2);

    // 圆角边框
    this.drawPixelCornerBorder(ctx, bubbleX, bubbleY, cornerSize, 'tl', colors.border);
    this.drawPixelCornerBorder(ctx, bubbleX + width - cornerSize, bubbleY, cornerSize, 'tr', colors.border);
    this.drawPixelCornerBorder(ctx, bubbleX, bubbleY + height - cornerSize, cornerSize, 'bl', colors.border);
    this.drawPixelCornerBorder(ctx, bubbleX + width - cornerSize, bubbleY + height - cornerSize, cornerSize, 'br', colors.border);

    // 尾巴边框
    this.drawPixelTailBorder(ctx, x, bubbleY + height, tailWidth, tailHeight, colors.border);

    // 内部高光效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(bubbleX + cornerSize, bubbleY + 2, width - cornerSize * 2, 3);
    ctx.fillRect(bubbleX + 2, bubbleY + cornerSize, 3, height - cornerSize * 2 - 5);
  }

  // 绘制像素风格圆角
  private drawPixelCorner(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    corner: 'tl' | 'tr' | 'bl' | 'br'
  ) {
    // 简化的像素圆角
    const pattern = [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ];

    const pixelSize = Math.floor(size / 3);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (pattern[row][col] === 1) {
          let px = x + col * pixelSize;
          let py = y + row * pixelSize;

          // 根据角落类型调整位置
          if (corner === 'tr') px = x + (2 - col) * pixelSize;
          if (corner === 'bl') py = y + (2 - row) * pixelSize;
          if (corner === 'br') {
            px = x + (2 - col) * pixelSize;
            py = y + (2 - row) * pixelSize;
          }

          ctx.fillRect(px, py, pixelSize, pixelSize);
        }
      }
    }
  }

  // 绘制像素圆角边框
  private drawPixelCornerBorder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    corner: 'tl' | 'tr' | 'bl' | 'br',
    color: string
  ) {
    ctx.fillStyle = color;
    const pixelSize = Math.floor(size / 3);

    // 简化的边框像素
    const borderPixels: { r: number; c: number }[] = [];

    if (corner === 'tl') {
      borderPixels.push({ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }, { r: 2, c: 0 });
    } else if (corner === 'tr') {
      borderPixels.push({ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 });
    } else if (corner === 'bl') {
      borderPixels.push({ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 });
    } else {
      borderPixels.push({ r: 0, c: 2 }, { r: 1, c: 2 }, { r: 2, c: 0 }, { r: 2, c: 1 });
    }

    borderPixels.forEach(p => {
      ctx.fillRect(x + p.c * pixelSize, y + p.r * pixelSize, pixelSize, pixelSize);
    });
  }

  // 绘制像素风格尾巴
  private drawPixelTail(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    _width: number,
    _height: number,
    fillStyle: string | CanvasGradient
  ) {
    ctx.fillStyle = fillStyle;

    // 像素风格尾巴
    const tailPixels = [
      { dx: -4, dy: 0, w: 8, h: 4 },
      { dx: -2, dy: 4, w: 4, h: 4 },
      { dx: 0, dy: 8, w: 2, h: 4 }
    ];

    tailPixels.forEach(p => {
      ctx.fillRect(x + p.dx, y + p.dy, p.w, p.h);
    });
  }

  // 绘制像素尾巴边框
  private drawPixelTailBorder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    _width: number,
    _height: number,
    color: string
  ) {
    ctx.fillStyle = color;

    // 左边缘
    ctx.fillRect(x - 4, y, 2, 4);
    ctx.fillRect(x - 2, y + 4, 2, 4);
    ctx.fillRect(x, y + 8, 2, 4);

    // 右边缘
    ctx.fillRect(x + 4, y, 2, 4);
    ctx.fillRect(x + 2, y + 4, 2, 4);
  }

  // 绘制动态省略号动画
  private renderAnimatedDots(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';

    // 动态显示 1-3 个点
    const dotsCount = Math.floor(this.dots) + 1;

    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < dotsCount ? 1 : 0.3;
      ctx.beginPath();
      ctx.arc(x - 12 + i * 12, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 绘制打字指示器动画
  private renderTypingIndicator(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const colors = ['#10B981', '#34D399', '#6EE7B7'];
    const offsets = [0, 4, 8];

    offsets.forEach((offset, index) => {
      const bounce = Math.sin(this.animationFrame * 0.3 + index * 0.5) * 2 + 2;
      ctx.fillStyle = colors[index];
      ctx.beginPath();
      ctx.arc(x + offset, y - bounce, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 绘制思考圆圈
  private drawThoughtCircles(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const circles = [
      { x: 0, y: 0, r: 5, alpha: 0.8 },
      { x: -10, y: 10, r: 4, alpha: 0.6 },
      { x: -18, y: 22, r: 3, alpha: 0.4 }
    ];

    circles.forEach(circle => {
      ctx.fillStyle = `rgba(255, 255, 255, ${circle.alpha})`;
      ctx.beginPath();
      ctx.arc(x + circle.x, y + circle.y, circle.r, 0, Math.PI * 2);
      ctx.fill();

      // 像素风格边框
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
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

  // 获取最大行宽
  private getMaxLineWidth(ctx: CanvasRenderingContext2D, lines: string[]): number {
    let maxWidth = 0;
    lines.forEach(line => {
      const width = ctx.measureText(line).width;
      if (width > maxWidth) maxWidth = width;
    });
    return maxWidth;
  }

  // 更新动画
  private updateAnimation() {
    const now = Date.now();
    if (now - this.lastUpdate > 80) {
      this.animationFrame++;

      // 省略号动画
      this.dots += 0.3 * this.dotsDirection;
      if (this.dots >= 2.5 || this.dots <= 0) {
        this.dotsDirection *= -1;
      }

      this.lastUpdate = now;
    }
  }
}
