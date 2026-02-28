/**
 * 测试脚本 - 验证 MasterAgent API 连接
 * 模拟前端输入并测试后端响应
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api/master';

// 测试用例
const testCases = [
  {
    name: '简单任务分析',
    task: '帮我写一个计算斐波那契数列的Python函数',
    context: ''
  },
  {
    name: '带上下文的复杂任务',
    task: '分析这个项目的性能瓶颈',
    context: '这是一个使用React和Node.js开发的全栈应用，最近用户反馈页面加载很慢。'
  },
  {
    name: '中文任务',
    task: '总结2024年AI发展的主要趋势',
    context: '需要从技术突破、商业应用、政策监管三个角度分析'
  }
];

async function testAnalyze(task: string, context?: string) {
  console.log(`\n📝 测试任务: ${task.substring(0, 50)}...`);
  
  try {
    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, context })
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error(`❌ 失败: ${data.error || data.message || 'Unknown error'}`);
      return null;
    }

    console.log(`✅ 成功!`);
    console.log(`   复杂度: ${data.analysis.complexity}`);
    console.log(`   预估时间: ${data.analysis.estimatedTime}分钟`);
    console.log(`   子任务数: ${data.analysis.subtasks?.length || 0}`);
    console.log(`   推荐Agent数: ${data.analysis.recommendedAgents}`);
    
    return data.analysis;
  } catch (error) {
    console.error(`❌ 请求失败: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 开始测试 MasterAgent API 连接...');
  console.log(`API地址: ${API_BASE}`);
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试: ${testCase.name}`);
    await testAnalyze(testCase.task, testCase.context);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✨ 测试完成');
}

// 运行测试
runTests().catch(console.error);
