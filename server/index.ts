import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import 'dotenv/config';

import { registerRoutes } from './routes/index.js';
import { agentManager } from './manager/AgentManager.js';
import type { SSEEvent } from './types.ts';

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
            const data = JSON.parse(message);
            console.log('WebSocket message received:', data);
            
            // 处理心跳
            if (data.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
          } catch (error) {
            console.error('WebSocket message parse error:', error);
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
