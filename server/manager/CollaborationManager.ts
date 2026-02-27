import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { masterAgent, type SubAgentInfo } from './MasterAgent.js';
import { agentManager } from './AgentManager.js';
import { agentFileManager } from './AgentFileManager.js';

// 消息类型
export type MessageType = 
  | 'question'      // 询问
  | 'answer'        // 回答
  | 'suggestion'    // 建议
  | 'notification'  // 通知
  | 'handoff'       // 任务移交
  | 'clarification' // 澄清
  | 'escalation';   // 升级

// 协作消息
export interface CollaborationMessage {
  id: string;
  type: MessageType;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  taskId?: string;
  subTaskId?: string;
  parentMessageId?: string;  // 回复的消息ID
  timestamp: number;
  metadata?: {
    urgency?: 'low' | 'medium' | 'high';
    requiresResponse?: boolean;
    responseDeadline?: number;
  };
}

// 对话会话
export interface CollaborationSession {
  id: string;
  taskId: string;
  participantIds: string[];
  messages: CollaborationMessage[];
  startTime: number;
  lastActivity: number;
  status: 'active' | 'paused' | 'closed';
  topic?: string;
}

// 协作请求
export interface CollaborationRequest {
  fromAgentId: string;
  toAgentId: string;
  type: MessageType;
  content: string;
  taskId?: string;
  subTaskId?: string;
  requireResponse?: boolean;
  metadata?: CollaborationMessage['metadata'];
}

// 协作事件
export interface CollaborationEvent {
  type: 'message_sent' | 'message_received' | 'session_created' | 'session_closed' | 'agent_joined' | 'agent_left';
  sessionId: string;
  messageId?: string;
  fromAgentId: string;
  toAgentId: string;
  data: any;
  timestamp: number;
}

// 对话记录存储
interface ConversationRecord {
  sessionId: string;
  taskId: string;
  messages: CollaborationMessage[];
  summary?: string;
  savedAt: number;
}

export class CollaborationManager extends EventEmitter {
  private sessions: Map<string, CollaborationSession> = new Map();
  private messages: Map<string, CollaborationMessage> = new Map();
  private records: Map<string, ConversationRecord> = new Map();
  private agentConversations: Map<string, Set<string>> = new Map(); // agentId -> sessionIds

  constructor() {
    super();
  }

  // ========== 会话管理 ==========

  /**
   * 创建协作会话
   */
  createSession(taskId: string, participantIds: string[], topic?: string): CollaborationSession {
    const sessionId = `session-${randomUUID()}`;
    
    const session: CollaborationSession = {
      id: sessionId,
      taskId,
      participantIds: [...new Set(participantIds)],
      messages: [],
      startTime: Date.now(),
      lastActivity: Date.now(),
      status: 'active',
      topic
    };

    this.sessions.set(sessionId, session);

    // 更新Agent的会话映射
    for (const agentId of participantIds) {
      if (!this.agentConversations.has(agentId)) {
        this.agentConversations.set(agentId, new Set());
      }
      this.agentConversations.get(agentId)!.add(sessionId);
    }

    this.emit('event', {
      type: 'session_created',
      sessionId,
      fromAgentId: '',
      toAgentId: '',
      data: { taskId, participantIds, topic },
      timestamp: Date.now()
    } as CollaborationEvent);

    console.log(`[CollaborationManager] Created session ${sessionId} for task ${taskId}`);
    
    return session;
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取任务相关的所有会话
   */
  getSessionsByTask(taskId: string): CollaborationSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.taskId === taskId);
  }

  /**
   * 关闭会话
   */
  async closeSession(sessionId: string, saveRecord: boolean = true): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'closed';

    // 保存对话记录
    if (saveRecord) {
      await this.saveConversationRecord(session);
    }

    // 从Agent的会话映射中移除
    for (const agentId of session.participantIds) {
      this.agentConversations.get(agentId)?.delete(sessionId);
    }

    this.emit('event', {
      type: 'session_closed',
      sessionId,
      fromAgentId: '',
      toAgentId: '',
      data: { messageCount: session.messages.length },
      timestamp: Date.now()
    } as CollaborationEvent);

    // 延迟清理会话
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 60000); // 1分钟后清理

    return true;
  }

  // ========== 消息传递 ==========

  /**
   * 发送协作消息
   */
  async sendMessage(request: CollaborationRequest): Promise<CollaborationMessage> {
    const { fromAgentId, toAgentId, type, content, taskId, subTaskId, requireResponse, metadata } = request;

    // 验证Agent存在
    const fromAgent = masterAgent.getSubAgent(fromAgentId);
    const toAgent = masterAgent.getSubAgent(toAgentId);
    
    if (!fromAgent) {
      throw new Error(`From agent not found: ${fromAgentId}`);
    }
    if (!toAgent) {
      throw new Error(`To agent not found: ${toAgentId}`);
    }

    // 创建消息
    const message: CollaborationMessage = {
      id: `msg-${randomUUID()}`,
      type,
      fromAgentId,
      toAgentId,
      content,
      taskId,
      subTaskId,
      timestamp: Date.now(),
      metadata: {
        requiresResponse: requireResponse ?? false,
        urgency: metadata?.urgency || 'medium',
        ...metadata
      }
    };

    // 存储消息
    this.messages.set(message.id, message);

    // 找到或创建会话
    let session = this.findOrCreateSession(fromAgentId, toAgentId, taskId);
    session.messages.push(message);
    session.lastActivity = Date.now();

    // 更新Agent状态
    fromAgent.status = 'typing';
    
    // 发射发送事件
    this.emit('event', {
      type: 'message_sent',
      sessionId: session.id,
      messageId: message.id,
      fromAgentId,
      toAgentId,
      data: { type, content: content.slice(0, 100) },
      timestamp: Date.now()
    } as CollaborationEvent);

    // 实际发送消息到目标Agent（通过AgentManager）
    try {
      await this.deliverMessageToAgent(message, toAgent);
      
      // 发射接收事件
      this.emit('event', {
        type: 'message_received',
        sessionId: session.id,
        messageId: message.id,
        fromAgentId,
        toAgentId,
        data: { type },
        timestamp: Date.now()
      } as CollaborationEvent);

    } catch (error) {
      console.error(`[CollaborationManager] Failed to deliver message:`, error);
      throw error;
    } finally {
      fromAgent.status = 'idle';
    }

    return message;
  }

  /**
   * 回复消息
   */
  async replyMessage(
    originalMessageId: string,
    content: string,
    type: MessageType = 'answer'
  ): Promise<CollaborationMessage> {
    const original = this.messages.get(originalMessageId);
    if (!original) {
      throw new Error(`Original message not found: ${originalMessageId}`);
    }

    // 交换发送者和接收者
    return this.sendMessage({
      fromAgentId: original.toAgentId,
      toAgentId: original.fromAgentId,
      type,
      content,
      taskId: original.taskId,
      subTaskId: original.subTaskId,
      requireResponse: false
    });
  }

  /**
   * 向Agent组广播消息
   */
  async broadcastMessage(
    fromAgentId: string,
    toAgentIds: string[],
    content: string,
    type: MessageType = 'notification',
    taskId?: string
  ): Promise<CollaborationMessage[]> {
    const messages: CollaborationMessage[] = [];
    
    for (const toAgentId of toAgentIds) {
      if (toAgentId === fromAgentId) continue;
      
      try {
        const msg = await this.sendMessage({
          fromAgentId,
          toAgentId,
          type,
          content,
          taskId,
          requireResponse: false
        });
        messages.push(msg);
      } catch (error) {
        console.error(`[CollaborationManager] Failed to broadcast to ${toAgentId}:`, error);
      }
    }

    return messages;
  }

  /**
   * 将消息实际传递给Agent
   */
  private async deliverMessageToAgent(
    message: CollaborationMessage,
    toAgent: SubAgentInfo
  ): Promise<void> {
    const fromAgent = masterAgent.getSubAgent(message.fromAgentId);
    
    // 构建协作上下文
    const contextMessage = this.buildCollaborationContext(message, fromAgent, toAgent);
    
    // 通过AgentManager发送
    const stream = await agentManager.sendMessage(message.toAgentId, contextMessage);
    
    if (!stream) {
      throw new Error(`Failed to send message to agent ${message.toAgentId}`);
    }

    // 收集响应（用于记录）
    let response = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    // 如果有要求回复，自动发送回复
    if (message.metadata?.requiresResponse && response) {
      // 延迟发送回复，避免过于频繁
      setTimeout(() => {
        this.sendMessage({
          fromAgentId: message.toAgentId,
          toAgentId: message.fromAgentId,
          type: 'answer',
          content: response,
          taskId: message.taskId,
          subTaskId: message.subTaskId,
          requireResponse: false
        }).catch(err => {
          console.error('[CollaborationManager] Auto-reply failed:', err);
        });
      }, 1000);
    }
  }

  /**
   * 构建协作上下文消息
   */
  private buildCollaborationContext(
    message: CollaborationMessage,
    fromAgent?: SubAgentInfo,
    toAgent?: SubAgentInfo
  ): string {
    const typeLabels: Record<MessageType, string> = {
      question: '❓ 询问',
      answer: '✅ 回答',
      suggestion: '💡 建议',
      notification: '📢 通知',
      handoff: '🔄 任务移交',
      clarification: '🔍 澄清',
      escalation: '⚠️ 升级'
    };

    let context = `【协作消息】${typeLabels[message.type]}

来自：${fromAgent?.name || message.fromAgentId}
接收：${toAgent?.name || message.toAgentId}
时间：${new Date(message.timestamp).toLocaleString()}`;

    if (message.taskId) {
      context += `\n任务：${message.taskId}`;
    }
    if (message.subTaskId) {
      context += `\n子任务：${message.subTaskId}`;
    }

    context += `\n\n---\n${message.content}\n---`;

    if (message.metadata?.requiresResponse) {
      context += '\n\n[需要回复]';
    }
    if (message.metadata?.urgency === 'high') {
      context += '\n[紧急]';
    }

    return context;
  }

  /**
   * 查找或创建会话
   */
  private findOrCreateSession(
    agentId1: string,
    agentId2: string,
    taskId?: string
  ): CollaborationSession {
    // 查找现有会话
    const sessions1 = this.agentConversations.get(agentId1) || new Set();
    const sessions2 = this.agentConversations.get(agentId2) || new Set();
    
    // 找共同会话
    for (const sessionId of sessions1) {
      if (sessions2.has(sessionId)) {
        const session = this.sessions.get(sessionId);
        if (session && session.status === 'active' && (!taskId || session.taskId === taskId)) {
          return session;
        }
      }
    }

    // 创建新会话
    return this.createSession(taskId || 'general', [agentId1, agentId2]);
  }

  // ========== 监控与查询 ==========

  /**
   * 获取Agent的所有会话
   */
  getAgentSessions(agentId: string): CollaborationSession[] {
    const sessionIds = this.agentConversations.get(agentId) || new Set();
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is CollaborationSession => !!s && s.status === 'active');
  }

  /**
   * 获取会话消息历史
   */
  getSessionMessages(sessionId: string, limit?: number): CollaborationMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    const messages = [...session.messages].sort((a, b) => a.timestamp - b.timestamp);
    return limit ? messages.slice(-limit) : messages;
  }

  /**
   * 获取两个Agent间的消息历史
   */
  getConversationHistory(
    agentId1: string,
    agentId2: string,
    taskId?: string
  ): CollaborationMessage[] {
    const sessions = this.getAgentSessions(agentId1)
      .filter(s => s.participantIds.includes(agentId2) && (!taskId || s.taskId === taskId));
    
    const allMessages: CollaborationMessage[] = [];
    for (const session of sessions) {
      allMessages.push(...session.messages);
    }
    
    return allMessages.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 获取未读消息（需要回复的消息）
   */
  getPendingResponses(agentId: string): CollaborationMessage[] {
    const messages: CollaborationMessage[] = [];
    
    for (const message of this.messages.values()) {
      if (message.toAgentId === agentId && 
          message.metadata?.requiresResponse &&
          !this.hasReply(message)) {
        messages.push(message);
      }
    }
    
    return messages.sort((a, b) => (b.metadata?.urgency === 'high' ? 1 : 0) - (a.metadata?.urgency === 'high' ? 1 : 0));
  }

  /**
   * 检查消息是否有回复
   */
  private hasReply(message: CollaborationMessage): boolean {
    for (const msg of this.messages.values()) {
      if (msg.parentMessageId === message.id) {
        return true;
      }
    }
    return false;
  }

  // ========== 记录保存 ==========

  /**
   * 保存对话记录
   */
  private async saveConversationRecord(session: CollaborationSession): Promise<void> {
    const record: ConversationRecord = {
      sessionId: session.id,
      taskId: session.taskId,
      messages: [...session.messages],
      savedAt: Date.now()
    };

    this.records.set(session.id, record);

    // 生成对话摘要
    const summary = await this.generateConversationSummary(session);
    record.summary = summary;

    // 可选：保存到文件
    try {
      const agentIds = session.participantIds.join('_');
      const filename = `collab_${session.taskId}_${agentIds}_${Date.now()}.json`;
      // 这里可以通过 agentFileManager 保存到Agent目录
      console.log(`[CollaborationManager] Saved conversation record: ${filename}`);
    } catch (error) {
      console.error('[CollaborationManager] Failed to save record:', error);
    }
  }

  /**
   * 生成对话摘要
   */
  private async generateConversationSummary(session: CollaborationSession): Promise<string> {
    if (session.messages.length === 0) return '无对话内容';

    const messageTypes = new Set(session.messages.map(m => m.type));
    const agentNames = session.participantIds
      .map(id => masterAgent.getSubAgent(id)?.name || id)
      .join(', ');

    return `会话参与Agent: ${agentNames} | ` +
           `消息数: ${session.messages.length} | ` +
           `消息类型: ${Array.from(messageTypes).join(', ')} | ` +
           `持续时间: ${Math.round((session.lastActivity - session.startTime) / 1000)}秒`;
  }

  /**
   * 获取所有对话记录
   */
  getAllRecords(): ConversationRecord[] {
    return Array.from(this.records.values())
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  /**
   * 获取任务的对话记录
   */
  getTaskRecords(taskId: string): ConversationRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.taskId === taskId)
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  // ========== 总指挥监控 ==========

  /**
   * 获取协作状态概览（供总指挥监控）
   */
  getCollaborationOverview(): {
    activeSessions: number;
    totalMessages: number;
    pendingResponses: number;
    agentActivity: { agentId: string; messageCount: number; lastActive: number }[];
  } {
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'active').length;
    
    const totalMessages = this.messages.size;
    
    // 计算待回复消息
    let pendingResponses = 0;
    for (const msg of this.messages.values()) {
      if (msg.metadata?.requiresResponse && !this.hasReply(msg)) {
        pendingResponses++;
      }
    }

    // 计算每个Agent的活动
    const agentStats = new Map<string, { messageCount: number; lastActive: number }>();
    for (const msg of this.messages.values()) {
      // 统计发送者
      const fromStats = agentStats.get(msg.fromAgentId) || { messageCount: 0, lastActive: 0 };
      fromStats.messageCount++;
      fromStats.lastActive = Math.max(fromStats.lastActive, msg.timestamp);
      agentStats.set(msg.fromAgentId, fromStats);

      // 统计接收者
      const toStats = agentStats.get(msg.toAgentId) || { messageCount: 0, lastActive: 0 };
      toStats.lastActive = Math.max(toStats.lastActive, msg.timestamp);
      agentStats.set(msg.toAgentId, toStats);
    }

    return {
      activeSessions,
      totalMessages,
      pendingResponses,
      agentActivity: Array.from(agentStats.entries())
        .map(([agentId, stats]) => ({ agentId, ...stats }))
        .sort((a, b) => b.lastActive - a.lastActive)
    };
  }

  /**
   * 获取需要关注的协作（高 urgency 或未回复）
   */
  getAttentionRequired(): {
    urgentMessages: CollaborationMessage[];
    staleConversations: CollaborationSession[];
  } {
    const urgentMessages: CollaborationMessage[] = [];
    const now = Date.now();

    // 查找高 urgency 且未回复的消息
    for (const msg of this.messages.values()) {
      if (msg.metadata?.urgency === 'high' && 
          msg.metadata?.requiresResponse &&
          !this.hasReply(msg)) {
        urgentMessages.push(msg);
      }
    }

    // 查找长时间无活动的会话（超过5分钟）
    const staleConversations = Array.from(this.sessions.values())
      .filter(s => s.status === 'active' && now - s.lastActivity > 5 * 60 * 1000);

    return { urgentMessages, staleConversations };
  }
}

// 导出单例
export const collaborationManager = new CollaborationManager();
