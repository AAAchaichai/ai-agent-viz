import type { AgentState, AnimationFrame, SpriteConfig } from '../types';

export class SpriteRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spriteSheet: HTMLImageElement | null = null;
  private currentAnimation: string = 'idle';
  private frameIndex: number = 0;
  private frameTimer: number = 0;
  private animations: Map<string, AnimationFrame[]> = new Map();
  private scale: number = 3;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    this.ctx = ctx;
    this.setupCanvas();
  }

  private setupCanvas() {
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.ctx.imageSmoothingEnabled = false;
  }

  async loadSpriteSheet(url: string, config: SpriteConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.spriteSheet = img;
        this.parseAnimations(config);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load sprite: ${url}`));
      img.src = url;
    });
  }

  private parseAnimations(config: SpriteConfig) {
    for (const [animName, frames] of Object.entries(config.animations)) {
      this.animations.set(animName, frames);
    }
  }

  // 生成程序化的像素精灵作为后备方案
  generateProceduralSprite(state: AgentState): ImageData {
    const size = 32;
    const imageData = this.ctx.createImageData(size, size);
    const data = imageData.data;

    const colors: Record<AgentState, [number, number, number]> = {
      idle: [100, 200, 100],
      typing: [100, 150, 255],
      thinking: [255, 200, 100],
      error: [255, 100, 100],
      success: [100, 255, 150]
    };

    const [r, g, b] = colors[state] || colors.idle;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        
        // 简单的像素角色形状
        const cx = size / 2;
        const cy = size / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 12) {
          // 身体
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else if (dist < 14) {
          // 轮廓
          data[idx] = r * 0.7;
          data[idx + 1] = g * 0.7;
          data[idx + 2] = b * 0.7;
          data[idx + 3] = 255;
        } else {
          // 透明
          data[idx + 3] = 0;
        }
      }
    }

    return imageData;
  }

  setAnimation(name: string) {
    if (this.animations.has(name) && this.currentAnimation !== name) {
      this.currentAnimation = name;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }
  }

  update(deltaTime: number) {
    const frames = this.animations.get(this.currentAnimation);
    if (!frames || frames.length === 0) return;

    this.frameTimer += deltaTime;
    const currentFrame = frames[this.frameIndex];

    if (this.frameTimer >= currentFrame.duration) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }
  }

  render(x: number, y: number, state: AgentState) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.spriteSheet) {
      this.renderFromSpriteSheet(x, y);
    } else {
      this.renderProcedural(x, y, state);
    }

    // 渲染状态指示器
    this.renderStateIndicator(x, y + 40, state);
  }

  private renderFromSpriteSheet(x: number, y: number) {
    const frames = this.animations.get(this.currentAnimation);
    if (!frames || !this.spriteSheet) return;

    const frame = frames[this.frameIndex];
    const size = 32 * this.scale;

    this.ctx.drawImage(
      this.spriteSheet,
      frame.x, frame.y, frame.width, frame.height,
      x - size / 2, y - size / 2, size, size
    );
  }

  private renderProcedural(x: number, y: number, state: AgentState) {
    const imageData = this.generateProceduralSprite(state);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 32;
    tempCanvas.height = 32;
    tempCanvas.getContext('2d')?.putImageData(imageData, 0, 0);

    const size = 32 * this.scale;
    this.ctx.drawImage(tempCanvas, x - size / 2, y - size / 2, size, size);
  }

  private renderStateIndicator(x: number, y: number, state: AgentState) {
    const colors: Record<AgentState, string> = {
      idle: '#64c864',
      typing: '#6496ff',
      thinking: '#ffc864',
      error: '#ff6464',
      success: '#64ff96'
    };

    this.ctx.fillStyle = colors[state];
    this.ctx.beginPath();
    this.ctx.arc(x, y, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // 状态文字
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(state.toUpperCase(), x, y + 20);
  }
}
