import type { AgentState } from '../types';

export class AgentStateMachine {
  private currentState: AgentState = 'idle';
  private previousState: AgentState = 'idle';
  private stateStartTime: number = Date.now();
  
  // 状态转换规则
  private transitions: Map<AgentState, AgentState[]> = new Map([
    ['idle', ['typing', 'thinking', 'error']],
    ['typing', ['idle', 'thinking', 'error', 'success']],
    ['thinking', ['typing', 'idle', 'error', 'success']],
    ['error', ['idle', 'typing']],
    ['success', ['idle', 'typing']]
  ]);

  // 状态处理器
  private handlers: Map<AgentState, {
    onEnter?: () => void;
    onExit?: () => void;
    onUpdate?: (deltaTime: number) => void;
  }> = new Map();

  // 监听器
  private listeners: Array<(newState: AgentState, oldState: AgentState) => void> = [];

  getCurrentState(): AgentState {
    return this.currentState;
  }

  getPreviousState(): AgentState {
    return this.previousState;
  }

  getStateDuration(): number {
    return Date.now() - this.stateStartTime;
  }

  canTransition(to: AgentState): boolean {
    const allowed = this.transitions.get(this.currentState);
    return allowed ? allowed.includes(to) : false;
  }

  transition(to: AgentState): boolean {
    if (!this.canTransition(to)) {
      console.warn(`Invalid state transition: ${this.currentState} -> ${to}`);
      return false;
    }

    const oldState = this.currentState;
    const handler = this.handlers.get(oldState);
    
    // 退出当前状态
    if (handler?.onExit) {
      handler.onExit();
    }

    // 更新状态
    this.previousState = oldState;
    this.currentState = to;
    this.stateStartTime = Date.now();

    // 进入新状态
    const newHandler = this.handlers.get(to);
    if (newHandler?.onEnter) {
      newHandler.onEnter();
    }

    // 通知监听器
    this.listeners.forEach(listener => listener(to, oldState));

    return true;
  }

  // 自动状态推断
  inferStateFromActivity(activity: {
    isProcessing?: boolean;
    isStreaming?: boolean;
    hasError?: boolean;
    isComplete?: boolean;
  }): AgentState {
    if (activity.hasError) return 'error';
    if (activity.isComplete) return 'success';
    if (activity.isStreaming) return 'typing';
    if (activity.isProcessing) return 'thinking';
    return 'idle';
  }

  autoTransition(activity: {
    isProcessing?: boolean;
    isStreaming?: boolean;
    hasError?: boolean;
    isComplete?: boolean;
  }) {
    const inferredState = this.inferStateFromActivity(activity);
    if (inferredState !== this.currentState) {
      this.transition(inferredState);
    }
  }

  update(deltaTime: number) {
    const handler = this.handlers.get(this.currentState);
    if (handler?.onUpdate) {
      handler.onUpdate(deltaTime);
    }
  }

  onStateChange(listener: (newState: AgentState, oldState: AgentState) => void) {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx > -1) this.listeners.splice(idx, 1);
    };
  }

  registerStateHandler(
    state: AgentState,
    handlers: {
      onEnter?: () => void;
      onExit?: () => void;
      onUpdate?: (deltaTime: number) => void;
    }
  ) {
    this.handlers.set(state, handlers);
  }
}
