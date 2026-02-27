import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Agent灵魂文件接口
export interface AgentSoul {
  agentId: string;
  name: string;
  model: string;
  apiKeyEncrypted: string;
  personality: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
}

// Agent技能接口
export interface AgentSkill {
  name: string;
  enabled: boolean;
}

export interface AgentSkills {
  agentId: string;
  skills: AgentSkill[];
}

// Agent记忆接口
export interface AgentMemory {
  agentId: string;
  memories: string[];
  workFiles: string[];
  conversations: Array<{
    id: string;
    timestamp: number;
    content: string;
  }>;
}

// 创建Agent的配置
export interface AgentFileConfig {
  name: string;
  model: string;
  apiKey?: string;
  personality?: string;
  role?: string;
  skills?: Array<{ name: string; enabled: boolean }>;
}

export class AgentFileManager {
  private basePath: string;

  constructor(basePath: string = path.join(process.cwd(), 'data', 'agents')) {
    this.basePath = basePath;
  }

  // 获取Agent目录路径
  private getAgentDir(agentId: string): string {
    return path.join(this.basePath, agentId);
  }

  // 获取文件路径
  private getFilePath(agentId: string, filename: string): string {
    return path.join(this.getAgentDir(agentId), filename);
  }

  // 确保目录存在
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  // 读取JSON文件
  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  // 写入JSON文件
  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // 简单的加密（实际生产环境应使用更安全的加密方式）
  private encryptApiKey(apiKey: string): string {
    // 使用Base64编码作为简单加密（实际应使用AES等）
    return Buffer.from(apiKey).toString('base64');
  }

  // 解密API Key
  private decryptApiKey(encryptedKey: string): string {
    return Buffer.from(encryptedKey, 'base64').toString('utf-8');
  }

  // ========== 灵魂文件操作 ==========

  async createSoulFile(agentId: string, config: AgentFileConfig): Promise<AgentSoul> {
    const soul: AgentSoul = {
      agentId,
      name: config.name,
      model: config.model,
      apiKeyEncrypted: config.apiKey ? this.encryptApiKey(config.apiKey) : '',
      personality: config.personality || '乐观开朗，乐于助人',
      role: config.role || '通用助手',
      createdAt: new Date().toISOString()
    };

    await this.writeJsonFile(this.getFilePath(agentId, 'soul.json'), soul);
    return soul;
  }

  async readSoulFile(agentId: string): Promise<AgentSoul | null> {
    return this.readJsonFile<AgentSoul>(this.getFilePath(agentId, 'soul.json'));
  }

  async updateSoulFile(agentId: string, data: Partial<AgentSoul>): Promise<AgentSoul | null> {
    const existing = await this.readSoulFile(agentId);
    if (!existing) return null;

    // 如果更新包含apiKey，需要加密
    if (data.apiKeyEncrypted && !data.apiKeyEncrypted.includes('=')) {
      data.apiKeyEncrypted = this.encryptApiKey(data.apiKeyEncrypted);
    }

    const updated: AgentSoul = {
      ...existing,
      ...data,
      agentId, // 确保agentId不被修改
      updatedAt: new Date().toISOString()
    };

    await this.writeJsonFile(this.getFilePath(agentId, 'soul.json'), updated);
    return updated;
  }

  // ========== 技能文件操作 ==========

  async createSkillsFile(agentId: string, skills?: Array<{ name: string; enabled: boolean }>): Promise<AgentSkills> {
    const defaultSkills: AgentSkill[] = [
      { name: '代码审查', enabled: true },
      { name: '文档生成', enabled: false },
      { name: '代码重构', enabled: true },
      { name: 'Bug修复', enabled: true },
      { name: '技术咨询', enabled: true }
    ];

    const agentSkills: AgentSkills = {
      agentId,
      skills: skills || defaultSkills
    };

    await this.writeJsonFile(this.getFilePath(agentId, 'skills.json'), agentSkills);
    return agentSkills;
  }

  async readSkillsFile(agentId: string): Promise<AgentSkills | null> {
    return this.readJsonFile<AgentSkills>(this.getFilePath(agentId, 'skills.json'));
  }

  async updateSkillsFile(agentId: string, skills: AgentSkill[]): Promise<AgentSkills | null> {
    const existing = await this.readSkillsFile(agentId);
    if (!existing) return null;

    const updated: AgentSkills = {
      ...existing,
      skills
    };

    await this.writeJsonFile(this.getFilePath(agentId, 'skills.json'), updated);
    return updated;
  }

  // ========== 记忆文件操作 ==========

  async createMemoryFile(agentId: string): Promise<AgentMemory> {
    const memory: AgentMemory = {
      agentId,
      memories: [],
      workFiles: [],
      conversations: []
    };

    await this.writeJsonFile(this.getFilePath(agentId, 'memory.json'), memory);
    return memory;
  }

  async readMemoryFile(agentId: string): Promise<AgentMemory | null> {
    return this.readJsonFile<AgentMemory>(this.getFilePath(agentId, 'memory.json'));
  }

  async updateMemoryFile(agentId: string, data: Partial<AgentMemory>): Promise<AgentMemory | null> {
    const existing = await this.readMemoryFile(agentId);
    if (!existing) return null;

    const updated: AgentMemory = {
      ...existing,
      ...data,
      agentId // 确保agentId不被修改
    };

    await this.writeJsonFile(this.getFilePath(agentId, 'memory.json'), updated);
    return updated;
  }

  // 添加记忆
  async addMemory(agentId: string, memory: string): Promise<AgentMemory | null> {
    const existing = await this.readMemoryFile(agentId);
    if (!existing) return null;

    existing.memories.push(memory);
    return this.updateMemoryFile(agentId, existing);
  }

  // 添加工作文件
  async addWorkFile(agentId: string, filePath: string): Promise<AgentMemory | null> {
    const existing = await this.readMemoryFile(agentId);
    if (!existing) return null;

    if (!existing.workFiles.includes(filePath)) {
      existing.workFiles.push(filePath);
    }
    return this.updateMemoryFile(agentId, existing);
  }

  // 添加对话记录
  async addConversation(agentId: string, content: string): Promise<AgentMemory | null> {
    const existing = await this.readMemoryFile(agentId);
    if (!existing) return null;

    existing.conversations.push({
      id: randomUUID(),
      timestamp: Date.now(),
      content
    });

    // 只保留最近100条对话
    if (existing.conversations.length > 100) {
      existing.conversations = existing.conversations.slice(-100);
    }

    return this.updateMemoryFile(agentId, existing);
  }

  // ========== 组合操作 ==========

  // 创建Agent的所有三个文件
  async createAgentFiles(agentId: string, config: AgentFileConfig): Promise<{
    soul: AgentSoul;
    skills: AgentSkills;
    memory: AgentMemory;
  }> {
    await this.ensureDir(this.getAgentDir(agentId));

    const [soul, skills, memory] = await Promise.all([
      this.createSoulFile(agentId, config),
      this.createSkillsFile(agentId, config.skills),
      this.createMemoryFile(agentId)
    ]);

    return { soul, skills, memory };
  }

  // 删除Agent的所有文件
  async deleteAgentFiles(agentId: string): Promise<boolean> {
    try {
      const agentDir = this.getAgentDir(agentId);
      await fs.rm(agentDir, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`[AgentFileManager] Failed to delete agent files for ${agentId}:`, error);
      return false;
    }
  }

  // 检查Agent文件是否存在
  async agentFilesExist(agentId: string): Promise<boolean> {
    try {
      const soulExists = await fs.access(this.getFilePath(agentId, 'soul.json')).then(() => true).catch(() => false);
      const skillsExists = await fs.access(this.getFilePath(agentId, 'skills.json')).then(() => true).catch(() => false);
      const memoryExists = await fs.access(this.getFilePath(agentId, 'memory.json')).then(() => true).catch(() => false);
      return soulExists && skillsExists && memoryExists;
    } catch {
      return false;
    }
  }

  // 获取所有Agent的文件列表
  async listAllAgentFiles(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch {
      return [];
    }
  }
}

// 导出单例
export const agentFileManager = new AgentFileManager();
