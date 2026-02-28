// 测试 MiniMax API 直接调用
import { MinimaxAdapter } from './adapters/MinimaxAdapter.js';

const config = {
  id: 'test',
  name: 'MiniMax M2.5',
  provider: 'minimax',
  baseUrl: 'https://api.minimaxi.com/anthropic',
  model: 'MiniMax-M2.5',
  temperature: 0.7,
  maxTokens: 2000,
  enabled: true,
  apiKey: process.env.MINIMAX_API_KEY
};

console.log('Testing MiniMax API...');
console.log('API Key:', config.apiKey ? '***set***' : '***NOT SET***');

const adapter = new MinimaxAdapter(config);

async function test() {
  try {
    const messages = [
      { role: 'system', content: '你是一个有帮助的助手。' },
      { role: 'user', content: '请用JSON格式返回 {"test": "ok"}' }
    ];
    
    console.log('Sending request...');
    const response = await adapter.chat(messages);
    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
