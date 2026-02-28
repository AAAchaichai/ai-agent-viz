import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { registerRoutes } from './routes/index.js';
import { agentManager } from './manager/AgentManager.js';
import type { SSEEvent } from './types.ts';

// 获取 __dirname 等价物（ESM 模块）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== WebSocket 消息类型定义 ==========

/** 基础 WebSocket 消息 */
interface BaseWebSocketMessage {
  type: string;
}

/** 心跳消息 */
interface PingMessage extends BaseWebSocketMessage {
  type: 'ping';
  timestamp?: number;
}

/** 订阅消息 */
interface SubscribeMessage extends BaseWebSocketMessage {
  type: 'subscribe';
  agentId?: string;
  taskId?: string;
}

/** 取消订阅消息 */
interface UnsubscribeMessage extends BaseWebSocketMessage {
  type: 'unsubscribe';
  agentId?: string;
  taskId?: string;
}

/** 客户端命令消息 */
interface CommandMessage extends BaseWebSocketMessage {
  type: 'command';
  command: string;
  payload?: Record<string, unknown>;
}

/** WebSocket 消息联合类型 */
type WebSocketMessage = PingMessage | SubscribeMessage | UnsubscribeMessage | CommandMessage;

/** 有效的消息类型集合 */
const VALID_MESSAGE_TYPES = new Set(['ping', 'subscribe', 'unsubscribe', 'command']);

// ========== 类型守卫函数 ==========

/**
 * 检查值是否为有效的 WebSocket 消息类型
 */
function isValidMessageType(type: unknown): type is WebSocketMessage['type'] {
  return typeof type === 'string' && VALID_MESSAGE_TYPES.has(type);
}

/**
 * 类型守卫：检查是否为有效的 WebSocket 消息对象
 */
function isWebSocketMessage(obj: unknown): obj is WebSocketMessage {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  const msg = obj as Record<string, unknown>;
  
  // 必须包含 type 字段且为有效类型
  if (!isValidMessageType(msg.type)) {
    return false;
  }
  
  // 验证特定类型的必需字段
  switch (msg.type) {
    case 'command':
      return typeof msg.command === 'string' && msg.command.length > 0;
    case 'ping':
    case 'subscribe':
    case 'unsubscribe':
      return true;
    default:
      return false;
  }
}

/**
 * 类型守卫：检查是否为 Ping 消息
 */
function isPingMessage(msg: WebSocketMessage): msg is PingMessage {
  return msg.type === 'ping';
}

/**
 * 类型守卫：检查是否为 Command 消息
 */
function isCommandMessage(msg: WebSocketMessage): msg is CommandMessage {
  return msg.type === 'command' && typeof (msg as CommandMessage).command === 'string';
}

// ========== 消息处理器 ==========

/**
 * 处理客户端消息
 */
function handleClientMessage(message: string): { valid: true; data: WebSocketMessage } | { valid: false; error: string } {
  try {
    const parsed = JSON.parse(message);
    
    if (!isWebSocketMessage(parsed)) {
      return { 
        valid: false, 
        error: `Invalid message format. Expected type in [${Array.from(VALID_MESSAGE_TYPES).join(', ')}]` 
      };
    }
    
    return { valid: true, data: parsed };
  } catch (error) {
    return { 
      valid: false, 
      error: 'Invalid JSON format' 
    };
  }
}

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: true
});

async function startServer() {
  try {
    // 注册 CORS
    await fastify.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });

    // 注册 WebSocket
    await fastify.register(websocket);

    // 注册 API 路由
    await registerRoutes(fastify);

    // 注册静态文件服务（部署后提供前端文件）
    const staticPath = path.join(__dirname, '../dist');
    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
      wildcard: false // 允许回退到 index.html
    });

    // SPA 回退：所有非 API 路由返回 index.html
    fastify.get('*', async (request, reply) => {
      // API 路由由 registerRoutes 处理，不会走到这里
      // 其他路由返回前端应用的 index.html
      return reply.sendFile('index.html');
    });

    // WebSocket 路由
    fastify.register(async function (fastify) {
      fastify.get('/ws/agent', { websocket: true }, (socket, req) => {
        console.log('WebSocket client connected');

        // 订阅所有事件并转发到 WebSocket
        const unsubscribe = agentManager.onEvent((event: SSEEvent) => {
          try {
            socket.send(JSON.stringify(event));
          } catch (error) {
            console.error('WebSocket send error:', error);
          }
        });

        // 处理客户端消息
        socket.on('message', (message: string) => {
          try {
            const validation = handleClientMessage(message);
            
            if (!validation.valid) {
              console.warn('WebSocket invalid message:', validation.error);
              socket.send(JSON.stringify({ 
                type: 'error', 
                error: validation.error,
                timestamp: Date.now() 
              }));
              return;
            }
            
            const data = validation.data;
            console.log('WebSocket message received:', { type: data.type });
            
            // 处理不同类型的消息
            if (isPingMessage(data)) {
              socket.send(JSON.stringify({ 
                type: 'pong', 
                timestamp: Date.now(),
                echo: data.timestamp 
              }));
            } else if (isCommandMessage(data)) {
              // 处理命令
              socket.send(JSON.stringify({
                type: 'command_ack',
                command: data.command,
                timestamp: Date.now()
              }));
            } else {
              // 其他已知类型（subscribe, unsubscribe）
              socket.send(JSON.stringify({
                type: 'ack',
                messageType: data.type,
                timestamp: Date.now()
              }));
            }
          } catch (error) {
            console.error('WebSocket message handling error:', error);
            socket.send(JSON.stringify({ 
              type: 'error', 
              error: 'Internal message handling error',
              timestamp: Date.now() 
            }));
          }
        });

        // 清理
        socket.on('close', () => {
          console.log('WebSocket client disconnected');
          unsubscribe();
        });
      });
    });

    // 启动服务器
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`🚀 AI Agent Viz Server running at http://${HOST}:${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://${HOST}:${PORT}/ws/agent`);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

startServer();
