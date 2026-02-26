#!/usr/bin/env node
/**
 * GitHub Actions 自动监控与修复脚本
 * 定期检查部署状态，自动修复常见问题
 */

const REPO = 'AAAchaichai/ai-agent-viz';
const WORKFLOW_FILE = 'deploy.yml';

// 检查最近的 workflow run 状态
async function checkWorkflowStatus() {
  try {
    // 使用 gh CLI 获取最近的工作流状态
    const { execSync } = require('child_process');
    
    const result = execSync(
      `gh run list --repo ${REPO} --workflow ${WORKFLOW_FILE} --limit 1 --json status,conclusion,url,headSha`,
      { encoding: 'utf8', timeout: 30000 }
    );
    
    const runs = JSON.parse(result);
    if (!runs || runs.length === 0) {
      return { status: 'unknown', message: 'No workflow runs found' };
    }
    
    const latest = runs[0];
    return {
      status: latest.status,
      conclusion: latest.conclusion,
      url: latest.url,
      sha: latest.headSha
    };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

// 自动修复常见问题
async function autoFix(error) {
  const fixes = [];
  
  // 修复1: gh-pages 分支冲突
  if (error.includes('Failed to create deployment') || error.includes('404')) {
    fixes.push('检测到部署冲突，尝试删除 gh-pages 分支...');
    try {
      const { execSync } = require('child_process');
      execSync(`gh api -X DELETE repos/${REPO}/git/refs/heads/gh-pages`, { timeout: 10000 });
      fixes.push('✅ 已删除 gh-pages 分支');
    } catch (e) {
      fixes.push(`❌ 删除分支失败: ${e.message}`);
    }
  }
  
  // 修复2: 触发重新部署
  fixes.push('触发重新部署...');
  try {
    const { execSync } = require('child_process');
    // 通过 API 触发 workflow_dispatch
    execSync(
      `gh workflow run ${WORKFLOW_FILE} --repo ${REPO}`,
      { timeout: 30000 }
    );
    fixes.push('✅ 已触发重新部署');
  } catch (e) {
    fixes.push(`❌ 触发部署失败: ${e.message}`);
  }
  
  return fixes;
}

// 主函数
async function main() {
  console.log('='.repeat(60));
  console.log('🔍 GitHub Actions 自动监控');
  console.log('='.repeat(60));
  console.log(`仓库: ${REPO}`);
  console.log(`时间: ${new Date().toLocaleString()}`);
  console.log('');
  
  const status = await checkWorkflowStatus();
  console.log('📊 最新部署状态:');
  console.log(`  状态: ${status.status}`);
  if (status.conclusion) {
    console.log(`  结果: ${status.conclusion}`);
  }
  if (status.url) {
    console.log(`  链接: ${status.url}`);
  }
  console.log('');
  
  // 检查是否需要修复
  if (status.conclusion === 'failure' || status.status === 'error') {
    console.log('⚠️ 检测到部署失败，尝试自动修复...');
    console.log('');
    
    const fixes = await autoFix(status.message || '');
    fixes.forEach(fix => console.log(fix));
    
    console.log('');
    console.log('⏳ 请在 2-3 分钟后检查部署状态');
  } else if (status.conclusion === 'success') {
    console.log('✅ 部署正常');
  } else {
    console.log('⏳ 部署进行中...');
  }
  
  console.log('');
  console.log('='.repeat(60));
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkWorkflowStatus, autoFix };
