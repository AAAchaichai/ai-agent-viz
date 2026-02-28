export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private zoom: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private gridSize: number = 40;
  
  // 离屏 Canvas 缓存网格（性能优化）
  private gridCache: HTMLCanvasElement | null = null;
  private gridCacheCtx: CanvasRenderingContext2D | null = null;
  
  // 渲染回调
  private onRenderCallback: ((ctx: RenderContext) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, width: number = 800, height: number = 600) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    
    this.setupCanvas();
  }

  private setupCanvas() {
    // 设置画布尺寸
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // 禁用图像平滑以保持像素风格
    this.ctx.imageSmoothingEnabled = false;
    
    // 设置样式
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    
    // 初始化网格缓存
    this.initGridCache();
  }

  // 初始化离屏网格缓存
  private initGridCache() {
    this.gridCache = document.createElement('canvas');
    this.gridCache.width = this.width;
    this.gridCache.height = this.height;
    
    const ctx = this.gridCache.getContext('2d');
    if (!ctx) return;
    this.gridCacheCtx = ctx;
    
    this.renderGridToCache();
  }

  // 渲染网格到离屏缓存
  private renderGridToCache() {
    if (!this.gridCacheCtx) return;
    
    const cols = Math.ceil(this.width / this.gridSize) + 2;
    const rows = Math.ceil(this.height / this.gridSize) + 2;
    
    this.gridCacheCtx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
    this.gridCacheCtx.lineWidth = 1;
    
    // 垂直线
    for (let i = -1; i <= cols; i++) {
      const x = i * this.gridSize;
      this.gridCacheCtx.beginPath();
      this.gridCacheCtx.moveTo(x, -this.gridSize);
      this.gridCacheCtx.lineTo(x, rows * this.gridSize);
      this.gridCacheCtx.stroke();
    }
    
    // 水平线
    for (let i = -1; i <= rows; i++) {
      const y = i * this.gridSize;
      this.gridCacheCtx.beginPath();
      this.gridCacheCtx.moveTo(-this.gridSize, y);
      this.gridCacheCtx.lineTo(cols * this.gridSize, y);
      this.gridCacheCtx.stroke();
    }
  }

  // 启动渲染循环
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
  }

  // 停止渲染循环
  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // 渲染循环
  private tick = () => {
    if (!this.isRunning) return;
    
    this.render();
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  // 渲染场景
  private render() {
    // 清空画布
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // 保存上下文
    this.ctx.save();
    
    // 应用视口变换
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.zoom, this.zoom);
    
    // 渲染网格地板
    this.renderGrid();
    
    // 调用外部渲染回调
    if (this.onRenderCallback) {
      this.onRenderCallback({
        ctx: this.ctx,
        width: this.width / this.zoom,
        height: this.height / this.zoom,
        zoom: this.zoom,
        offsetX: this.offsetX,
        offsetY: this.offsetY
      });
    }
    
    // 恢复上下文
    this.ctx.restore();
  }

  // 渲染网格地板（使用离屏缓存优化性能）
  private renderGrid() {
    if (this.gridCache) {
      // 直接绘制缓存的网格
      this.ctx.drawImage(this.gridCache, 0, 0);
    } else {
      // 降级：直接绘制（兼容旧浏览器）
      const cols = Math.ceil(this.width / this.gridSize / this.zoom) + 2;
      const rows = Math.ceil(this.height / this.gridSize / this.zoom) + 2;
      
      this.ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
      this.ctx.lineWidth = 1;
      
      // 垂直线
      for (let i = -1; i <= cols; i++) {
        const x = i * this.gridSize;
        this.ctx.beginPath();
        this.ctx.moveTo(x, -this.gridSize);
        this.ctx.lineTo(x, rows * this.gridSize);
        this.ctx.stroke();
      }
      
      // 水平线
      for (let i = -1; i <= rows; i++) {
        const y = i * this.gridSize;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.gridSize, y);
        this.ctx.lineTo(cols * this.gridSize, y);
        this.ctx.stroke();
      }
    }
  }

  // 设置渲染回调
  onRender(callback: (ctx: RenderContext) => void) {
    this.onRenderCallback = callback;
  }

  // 设置视口
  setViewport(x: number, y: number, zoom: number) {
    this.offsetX = x;
    this.offsetY = y;
    this.zoom = Math.max(0.5, Math.min(3, zoom)); // 限制缩放范围
  }

  // 获取视口信息
  getViewport() {
    return {
      x: this.offsetX,
      y: this.offsetY,
      zoom: this.zoom
    };
  }

  // 世界坐标转屏幕坐标
  worldToScreen(worldX: number, worldY: number) {
    return {
      x: worldX * this.zoom + this.offsetX,
      y: worldY * this.zoom + this.offsetY
    };
  }

  // 屏幕坐标转世界坐标
  screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX - this.offsetX) / this.zoom,
      y: (screenY - this.offsetY) / this.zoom
    };
  }

  // 调整画布大小
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    // 重新生成网格缓存
    this.initGridCache();
  }

  // 获取上下文（用于直接绘制）
  getContext() {
    return this.ctx;
  }
}
