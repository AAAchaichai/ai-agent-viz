import type { GameLoopCallbacks } from '../types';

export class GameLoop {
  private running: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private callbacks: GameLoopCallbacks;
  private frameInterval: number = 1000 / 60;

  constructor(callbacks: GameLoopCallbacks, targetFPS: number = 60) {
    this.callbacks = callbacks;
    this.frameInterval = 1000 / targetFPS;
  }

  start() {
    if (this.running) return;
    
    this.running = true;
    this.lastFrameTime = performance.now();
    this.tick(this.lastFrameTime);
  }

  stop() {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private tick(currentTime: number) {
    if (!this.running) return;

    const deltaTime = currentTime - this.lastFrameTime;

    // 限制帧率
    if (deltaTime >= this.frameInterval) {
      this.lastFrameTime = currentTime - (deltaTime % this.frameInterval);
      
      // 更新逻辑
      this.callbacks.onUpdate(deltaTime);
      
      // 渲染
      this.callbacks.onRender();
    }

    this.animationFrameId = requestAnimationFrame((time) => this.tick(time));
  }

  isRunning(): boolean {
    return this.running;
  }
}
