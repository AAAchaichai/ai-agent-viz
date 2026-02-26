export interface MessageBubble {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  position: { x: number; y: number };
  opacity: number;
  scale: number;
}

export class MessageRenderer {
  private bubbles: Map<string, MessageBubble> = new Map();
  
  // 配置
  private readonly bubbleMaxWidth = 280;
  private readonly bubblePadding = 12;
  private readonly lineHeight = 18;
  private readonly fontSize = 13;
  private readonly fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  private readonly showDuration = 8000; // 8秒后淡出
  private readonly fadeDuration = 1000; // 淡出动画1秒

  init(): void {
    // 渲染器初始化
  }

  /**
   * 添加消息气泡
   */
  addBubble(
    id: string,
    senderId: string,
    senderName: string,
    content: string,
    position: { x: number; y: number }
  ): void {
    const bubble: MessageBubble = {
      id,
      senderId,
      senderName,
      content: content.slice(0, 200), // 限制长度
      timestamp: Date.now(),
      position: { ...position },
      opacity: 0,
      scale: 0.8
    };
    
    this.bubbles.set(id, bubble);
  }

  /**
   * 移除消息气泡
   */
  removeBubble(id: string): void {
    this.bubbles.delete(id);
  }

  /**
   * 清除所有气泡
   */
  clear(): void {
    this.bubbles.clear();
  }

  /**
   * 更新气泡状态
   */
  update(): void {
    const now = Date.now();
    
    for (const [id, bubble] of this.bubbles) {
      const age = now - bubble.timestamp;
      
      // 入场动画
      if (age < 300) {
        bubble.opacity = Math.min(1, age / 200);
        bubble.scale = 0.8 + (age / 300) * 0.2;
      } 
      // 淡出动画
      else if (age > this.showDuration) {
        const fadeProgress = (age - this.showDuration) / this.fadeDuration;
        bubble.opacity = Math.max(0, 1 - fadeProgress);
        bubble.scale = 1 - fadeProgress * 0.1;
        
        if (bubble.opacity <= 0) {
          this.bubbles.delete(id);
        }
      } else {
        bubble.opacity = 1;
        bubble.scale = 1;
      }
    }
  }

  /**
   * 渲染所有消息气泡
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!ctx) return;

    for (const bubble of this.bubbles.values()) {
      this.renderBubble(ctx, bubble);
    }
  }

  /**
   * 渲染单个气泡
   */
  private renderBubble(ctx: CanvasRenderingContext2D, bubble: MessageBubble): void {
    const { x, y } = bubble.position;
    const { content, senderName, opacity, scale } = bubble;
    
    if (opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = opacity;
    
    // 应用缩放
    const centerX = x;
    const centerY = y - 60; // 在Agent上方显示
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    // 设置字体
    ctx.font = `600 12px ${this.fontFamily}`;
    const nameMetrics = ctx.measureText(senderName);
    const nameWidth = nameMetrics.width;

    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    
    // 计算文字换行
    const lines = this.wrapText(ctx, content, this.bubbleMaxWidth - this.bubblePadding * 2);
    
    // 计算气泡尺寸
    let maxLineWidth = 0;
    for (const line of lines) {
      const metrics = ctx.measureText(line);
      maxLineWidth = Math.max(maxLineWidth, metrics.width);
    }
    
    const bubbleWidth = Math.max(maxLineWidth + this.bubblePadding * 2, nameWidth + 24);
    const bubbleHeight = lines.length * this.lineHeight + this.bubblePadding * 2 + 20; // 20 for name

    const bubbleX = centerX - bubbleWidth / 2;
    const bubbleY = centerY - bubbleHeight;

    // 绘制阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // 绘制气泡背景
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 12);
    ctx.fill();

    // 绘制小三角
    ctx.beginPath();
    ctx.moveTo(centerX - 8, bubbleY + bubbleHeight);
    ctx.lineTo(centerX, bubbleY + bubbleHeight + 8);
    ctx.lineTo(centerX + 8, bubbleY + bubbleHeight);
    ctx.closePath();
    ctx.fill();

    // 清除阴影
    ctx.shadowColor = 'transparent';

    // 绘制发送者名字
    ctx.fillStyle = '#3b82f6';
    ctx.font = `600 12px ${this.fontFamily}`;
    ctx.fillText(senderName, bubbleX + this.bubblePadding, bubbleY + 22);

    // 绘制时间戳
    const timeStr = this.formatTime(bubble.timestamp);
    ctx.fillStyle = '#9ca3af';
    ctx.font = `10px ${this.fontFamily}`;
    ctx.fillText(timeStr, bubbleX + bubbleWidth - this.bubblePadding - ctx.measureText(timeStr).width, bubbleY + 22);

    // 绘制分隔线
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bubbleX + this.bubblePadding, bubbleY + 30);
    ctx.lineTo(bubbleX + bubbleWidth - this.bubblePadding, bubbleY + 30);
    ctx.stroke();

    // 绘制消息内容
    ctx.fillStyle = '#1f2937';
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    let lineY = bubbleY + 30 + this.lineHeight + 4;
    for (const line of lines) {
      ctx.fillText(line, bubbleX + this.bubblePadding, lineY);
      lineY += this.lineHeight;
    }

    ctx.restore();
  }

  /**
   * 文字自动换行
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = '';

    for (const char of words) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }

    // 如果行数太多，截断并添加省略号
    const maxLines = 6;
    if (lines.length > maxLines) {
      const truncated = lines.slice(0, maxLines);
      const lastLine = truncated[truncated.length - 1];
      truncated[truncated.length - 1] = lastLine.slice(0, -2) + '...';
      return truncated;
    }

    return lines;
  }

  /**
   * 绘制圆角矩形
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * 格式化时间
   */
  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * 获取当前所有气泡
   */
  getBubbles(): MessageBubble[] {
    return Array.from(this.bubbles.values());
  }
}
