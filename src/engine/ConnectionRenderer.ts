export interface ConnectionLine {
  id: string;
  fromId: string;
  toId: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  progress: number; // 0-1
  speed: number;
  color: string;
  opacity: number;
  message?: string;
  isActive: boolean;
}

export class ConnectionRenderer {
  private connections: Map<string, ConnectionLine> = new Map();
  private particles: Map<string, Array<{ t: number; speed: number }>> = new Map();
  
  // 配置
  private readonly lineWidth = 3;
  private readonly particleSize = 6;
  private readonly glowSize = 12;
  private readonly defaultSpeed = 0.02;

  /**
   * 创建连接线
   */
  createConnection(
    id: string,
    fromId: string,
    toId: string,
    fromPosition: { x: number; y: number },
    toPosition: { x: number; y: number },
    color: string = '#3b82f6',
    message?: string
  ): ConnectionLine {
    const connection: ConnectionLine = {
      id,
      fromId,
      toId,
      fromPosition: { ...fromPosition },
      toPosition: { ...toPosition },
      progress: 0,
      speed: this.defaultSpeed,
      color,
      opacity: 1,
      message,
      isActive: true
    };

    this.connections.set(id, connection);
    
    // 初始化粒子
    this.particles.set(id, [
      { t: 0, speed: this.defaultSpeed },
      { t: 0.3, speed: this.defaultSpeed },
      { t: 0.6, speed: this.defaultSpeed }
    ]);

    return connection;
  }

  /**
   * 更新连接线位置
   */
  updateConnectionPosition(
    id: string,
    fromPosition: { x: number; y: number },
    toPosition: { x: number; y: number }
  ): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.fromPosition = { ...fromPosition };
      connection.toPosition = { ...toPosition };
    }
  }

  /**
   * 移除连接线
   */
  removeConnection(id: string): void {
    this.connections.delete(id);
    this.particles.delete(id);
  }

  /**
   * 清除所有连接线
   */
  clear(): void {
    this.connections.clear();
    this.particles.clear();
  }

  /**
   * 更新动画状态
   */
  update(): void {
    for (const [id, connection] of this.connections) {
      if (!connection.isActive) continue;

      // 更新进度
      connection.progress += connection.speed;
      if (connection.progress >= 1) {
        connection.progress = 1;
        connection.isActive = false; // 到达终点后停止
      }

      // 更新粒子
      const particles = this.particles.get(id);
      if (particles) {
        for (const particle of particles) {
          particle.t += particle.speed;
          if (particle.t >= 1) {
            particle.t = 0; // 循环
          }
        }
      }
    }
  }

  /**
   * 渲染所有连接线
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!ctx) return;

    for (const connection of this.connections.values()) {
      this.renderConnection(ctx, connection);
    }
  }

  /**
   * 渲染单个连接线
   */
  private renderConnection(ctx: CanvasRenderingContext2D, connection: ConnectionLine): void {
    const { fromPosition, toPosition, color, opacity, isActive } = connection;
    
    if (opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = opacity;

    // 计算贝塞尔曲线控制点
    const midX = (fromPosition.x + toPosition.x) / 2;
    const midY = (fromPosition.y + toPosition.y) / 2 - 50; // 向上弯曲

    // 绘制基础连线（虚线）
    ctx.strokeStyle = color + '40'; // 25%透明度
    ctx.lineWidth = this.lineWidth;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(fromPosition.x, fromPosition.y);
    ctx.quadraticCurveTo(midX, midY, toPosition.x, toPosition.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (isActive) {
      // 绘制流动效果
      const gradient = ctx.createLinearGradient(
        fromPosition.x, fromPosition.y,
        toPosition.x, toPosition.y
      );
      gradient.addColorStop(0, color + '00');
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, color + '00');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = this.lineWidth + 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = this.glowSize;
      ctx.beginPath();
      ctx.moveTo(fromPosition.x, fromPosition.y);
      ctx.quadraticCurveTo(midX, midY, toPosition.x, toPosition.y);
      ctx.stroke();

      // 绘制粒子
      const particles = this.particles.get(connection.id);
      if (particles) {
        for (const particle of particles) {
          const pos = this.getBezierPoint(
            particle.t,
            fromPosition,
            { x: midX, y: midY },
            toPosition
          );
          
          // 粒子发光效果
          ctx.shadowColor = color;
          ctx.shadowBlur = this.glowSize;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, this.particleSize, 0, Math.PI * 2);
          ctx.fill();
          
          // 粒子核心
          ctx.shadowBlur = 0;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, this.particleSize * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 绘制进度指示器
      const progressPos = this.getBezierPoint(
        connection.progress,
        fromPosition,
        { x: midX, y: midY },
        toPosition
      );
      
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = this.glowSize;
      ctx.beginPath();
      ctx.arc(progressPos.x, progressPos.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // 绘制消息预览（如果有）
      if (connection.message) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1f2937';
        ctx.font = "12px 'Inter', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(
          connection.message.slice(0, 20) + (connection.message.length > 20 ? '...' : ''),
          progressPos.x,
          progressPos.y - 15
        );
      }
    }

    ctx.restore();
  }

  /**
   * 获取贝塞尔曲线上的点
   */
  private getBezierPoint(
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): { x: number; y: number } {
    const oneMinusT = 1 - t;
    return {
      x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
      y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y
    };
  }

  /**
   * 获取所有连接线
   */
  getConnections(): ConnectionLine[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取连接数量
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 检查是否存在连接
   */
  hasConnection(id: string): boolean {
    return this.connections.has(id);
  }
}
