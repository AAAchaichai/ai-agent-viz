import { FastifyInstance } from 'fastify';
import { masterAgent, type TaskAnalysis } from '../manager/MasterAgent.js';
import { taskScheduler, type SchedulerEvent } from '../manager/TaskScheduler.js';
import { taskExecutor, type ExecuteEvent } from '../manager/TaskExecutor.js';
import { collaborationManager, type CollaborationEvent } from '../manager/CollaborationManager.js';
import { resultAggregator, type AggregatedResult } from '../manager/ResultAggregator.js';
import { exceptionHandler, type ExceptionRecord, type ExceptionEvent } from '../manager/ExceptionHandler.js';

// 内存存储（后续可迁移到数据库）
const analysisCache = new Map<string, TaskAnalysis>();

export async function registerMasterRoutes(fastify: FastifyInstance) {

  // ========== 任务分析 ==========

  /**
   * POST /api/master/analyze
   * 分析任务，返回复杂度评估和子任务分解
   */
  fastify.post('/api/master/analyze', async (request, reply) => {
    const { task, context } = request.body as {
      task: string;
      context?: string;
    };

    if (!task || typeof task !== 'string') {
      reply.status(400);
      return { error: 'Missing required field: task (string)' };
    }

    try {
      // 构建完整任务描述
      const fullTask = context 
        ? `[上下文]\n${context}\n\n[任务]\n${task}`
        : task;

      const analysis = await masterAgent.analyzeTask(fullTask);
      
      // 缓存分析结果
      analysisCache.set(analysis.id, analysis);

      return {
        success: true,
        analysis: {
          id: analysis.id,
          originalTask: analysis.originalTask,
          complexity: analysis.complexity,
          estimatedTime: analysis.estimatedTime,
          reasoning: analysis.reasoning,
          subtasks: analysis.subtasks.map(st => ({
            id: st.id,
            title: st.title,
            description: st.description,
            priority: st.priority,
            estimatedMinutes: st.estimatedMinutes,
            dependencies: st.dependencies,
            requiredSkills: st.requiredSkills,
            status: st.status
          })),
          requiredSkills: analysis.requiredSkills,
          recommendedAgents: analysis.recommendedAgents
        }
      };
    } catch (error) {
      console.error('[Master API] Analyze error:', error);
      reply.status(500);
      return {
        error: 'Task analysis failed',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // ========== 子Agent团队管理 ==========

  /**
   * POST /api/master/create-team
   * 根据任务分析创建子Agent团队
   */
  fastify.post('/api/master/create-team', async (request, reply) => {
    const { analysisId, agentNames } = request.body as {
      analysisId: string;
      agentNames?: string[];
    };

    if (!analysisId) {
      reply.status(400);
      return { error: 'Missing required field: analysisId' };
    }

    const analysis = analysisCache.get(analysisId);
    if (!analysis) {
      reply.status(404);
      return { error: 'Analysis not found' };
    }

    try {
      const team = await masterAgent.createSubAgentTeam(analysis, agentNames);

      return {
        success: true,
        team: team.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          skills: agent.skills,
          status: agent.status,
          completedTasks: agent.completedTasks
        }))
      };
    } catch (error) {
      console.error('[Master API] Create team error:', error);
      reply.status(500);
      return {
        error: 'Failed to create agent team',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  /**
   * GET /api/master/agents
   * 获取所有子Agent
   */
  fastify.get('/api/master/agents', async () => {
    const agents = masterAgent.getAllSubAgents();
    return {
      success: true,
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        skills: agent.skills,
        status: agent.status,
        currentTaskId: agent.currentTaskId,
        completedTasks: agent.completedTasks
      }))
    };
  });

  /**
   * GET /api/master/agents/:id
   * 获取指定子Agent详情
   */
  fastify.get('/api/master/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = masterAgent.getSubAgent(id);

    if (!agent) {
      reply.status(404);
      return { error: 'Agent not found' };
    }

    return {
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        skills: agent.skills,
        status: agent.status,
        currentTaskId: agent.currentTaskId,
        completedTasks: agent.completedTasks
      }
    };
  });

  /**
   * DELETE /api/master/agents/:id
   * 删除子Agent
   */
  fastify.delete('/api/master/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const success = await masterAgent.removeSubAgent(id);
      if (!success) {
        reply.status(404);
        return { error: 'Agent not found' };
      }

      return { success: true };
    } catch (error) {
      reply.status(500);
      return {
        error: 'Failed to remove agent',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // ========== 任务分配与执行 ==========

  /**
   * POST /api/master/assign
   * 分配任务给团队并启动执行
   */
  fastify.post('/api/master/assign', async (request, reply) => {
    const { analysisId } = request.body as {
      analysisId: string;
    };

    if (!analysisId) {
      reply.status(400);
      return { error: 'Missing required field: analysisId' };
    }

    const analysis = analysisCache.get(analysisId);
    if (!analysis) {
      reply.status(404);
      return { error: 'Analysis not found' };
    }

    // 获取或创建子Agent团队
    let agents = masterAgent.getAllSubAgents();
    if (agents.length === 0) {
      agents = await masterAgent.createSubAgentTeam(analysis);
    }

    // 提交任务到调度器
    try {
      await taskScheduler.submitTask(analysis, agents);

      return {
        success: true,
        message: 'Task assigned and execution started',
        taskId: analysis.id,
        assignedAgents: agents.map(a => ({ id: a.id, name: a.name }))
      };
    } catch (error) {
      console.error('[Master API] Assign error:', error);
      reply.status(500);
      return {
        error: 'Failed to assign task',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  /**
   * POST /api/master/execute
   * 直接执行分析过的任务（一站式接口）
   */
  fastify.post('/api/master/execute', async (request, reply) => {
    const { task, context, agentNames } = request.body as {
      task: string;
      context?: string;
      agentNames?: string[];
    };

    if (!task) {
      reply.status(400);
      return { error: 'Missing required field: task' };
    }

    try {
      // 1. 分析任务
      const fullTask = context ? `[上下文]\n${context}\n\n[任务]\n${task}` : task;
      const analysis = await masterAgent.analyzeTask(fullTask);
      analysisCache.set(analysis.id, analysis);

      // 2. 创建团队
      const team = await masterAgent.createSubAgentTeam(analysis, agentNames);

      // 3. 提交执行
      await taskScheduler.submitTask(analysis, team);

      return {
        success: true,
        taskId: analysis.id,
        complexity: analysis.complexity,
        estimatedTime: analysis.estimatedTime,
        subtaskCount: analysis.subtasks.length,
        teamSize: team.length,
        team: team.map(a => ({ id: a.id, name: a.name, role: a.role }))
      };
    } catch (error) {
      console.error('[Master API] Execute error:', error);
      reply.status(500);
      return {
        error: 'Task execution failed',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // ========== 结果聚合 ==========

  /**
   * POST /api/master/aggregate/:taskId
   * 聚合任务结果并生成报告
   */
  fastify.post('/api/master/aggregate/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { format } = request.query as { format?: 'markdown' | 'html' | 'json' };

    try {
      const analysis = analysisCache.get(taskId);
      const aggregatedResult = await resultAggregator.aggregateResults(taskId, analysis);

      if (format) {
        const exportContent = resultAggregator.exportReport(taskId, format);
        if (!exportContent) {
          reply.status(404);
          return { error: 'Report not found' };
        }

        reply.header('Content-Type', format === 'json' ? 'application/json' : format === 'html' ? 'text/html' : 'text/markdown');
        return exportContent;
      }

      return {
        success: true,
        result: {
          taskId: aggregatedResult.taskId,
          status: aggregatedResult.status,
          summary: aggregatedResult.summary,
          metrics: aggregatedResult.metrics,
          completedAt: aggregatedResult.completedAt
        }
      };
    } catch (error) {
      console.error('[Master API] Aggregate error:', error);
      reply.status(500);
      return {
        error: 'Failed to aggregate results',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  /**
   * GET /api/master/report/:taskId
   * 获取任务报告（支持多种格式）
   */
  fastify.get('/api/master/report/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { format = 'markdown' } = request.query as { format?: 'markdown' | 'html' | 'json' };

    const report = resultAggregator.exportReport(taskId, format);
    if (!report) {
      reply.status(404);
      return { error: 'Report not found' };
    }

    reply.header('Content-Type', format === 'json' ? 'application/json' : format === 'html' ? 'text/html' : 'text/markdown');
    return report;
  });

  // ========== 协作管理 ==========

  /**
   * POST /api/master/collaborate
   * 发送Agent间协作消息
   */
  fastify.post('/api/master/collaborate', async (request, reply) => {
    const { fromAgentId, toAgentId, type, content, taskId, requireResponse } = request.body as {
      fromAgentId: string;
      toAgentId: string;
      type: 'question' | 'answer' | 'suggestion' | 'notification' | 'handoff' | 'clarification' | 'escalation';
      content: string;
      taskId?: string;
      requireResponse?: boolean;
    };

    if (!fromAgentId || !toAgentId || !content) {
      reply.status(400);
      return { error: 'Missing required fields: fromAgentId, toAgentId, content' };
    }

    try {
      const message = await collaborationManager.sendMessage({
        fromAgentId,
        toAgentId,
        type,
        content,
        taskId,
        requireResponse
      });

      return {
        success: true,
        message: {
          id: message.id,
          type: message.type,
          timestamp: message.timestamp
        }
      };
    } catch (error) {
      console.error('[Master API] Collaborate error:', error);
      reply.status(500);
      return {
        error: 'Failed to send collaboration message',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  /**
   * GET /api/master/collaboration/:taskId
   * 获取任务的协作消息历史
   */
  fastify.get('/api/master/collaboration/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };

    const sessions = collaborationManager.getSessionsByTask(taskId);
    
    return {
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        participantIds: s.participantIds,
        messageCount: s.messages.length,
        startTime: s.startTime,
        lastActivity: s.lastActivity,
        status: s.status
      }))
    };
  });

  /**
   * GET /api/master/collaboration-overview
   * 获取协作概览
   */
  fastify.get('/api/master/collaboration-overview', async () => {
    return {
      success: true,
      overview: collaborationManager.getCollaborationOverview()
    };
  });

  // ========== 异常处理 ==========

  /**
   * GET /api/master/exceptions
   * 获取所有异常记录
   */
  fastify.get('/api/master/exceptions', async (request) => {
    const { taskId, status, requiringHuman } = request.query as {
      taskId?: string;
      status?: string;
      requiringHuman?: string;
    };

    let exceptions: ExceptionRecord[];

    if (taskId) {
      exceptions = exceptionHandler.getTaskExceptions(taskId);
    } else if (requiringHuman === 'true') {
      exceptions = exceptionHandler.getRequiringHumanIntervention();
    } else if (status) {
      exceptions = exceptionHandler.getPendingExceptions().filter(e => e.status === status);
    } else {
      exceptions = Array.from(exceptionHandler.getPendingExceptions());
    }

    return {
      success: true,
      exceptions: exceptions.map(e => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        taskId: e.taskId,
        message: e.message,
        status: e.status,
        timestamp: e.timestamp,
        requiresHumanIntervention: e.requiresHumanIntervention
      }))
    };
  });

  /**
   * POST /api/master/exceptions/:exceptionId/respond
   * 响需要人工介入的异常
   */
  fastify.post('/api/master/exceptions/:exceptionId/respond', async (request, reply) => {
    const { exceptionId } = request.params as { exceptionId: string };
    const { decision, notes, respondedBy } = request.body as {
      decision: 'retry' | 'skip' | 'abort' | 'reassign';
      notes?: string;
      respondedBy: string;
    };

    if (!decision || !respondedBy) {
      reply.status(400);
      return { error: 'Missing required fields: decision, respondedBy' };
    }

    const success = exceptionHandler.respondToIntervention(exceptionId, decision, respondedBy, notes);
    if (!success) {
      reply.status(404);
      return { error: 'Exception not found or not requiring intervention' };
    }

    return { success: true };
  });

  /**
   * POST /api/master/pause/:taskId
   * 暂停任务执行
   */
  fastify.post('/api/master/pause/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    
    // 使用 ExceptionHandler 暂停
    const paused = exceptionHandler.pauseTask(taskId, 'Manual pause by user');
    if (!paused) {
      reply.status(400);
      return { error: 'Failed to pause task' };
    }

    return { success: true, message: 'Task paused' };
  });

  /**
   * POST /api/master/resume/:taskId
   * 恢复任务执行
   */
  fastify.post('/api/master/resume/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    
    const resumed = exceptionHandler.resumeTask(taskId);
    if (!resumed) {
      reply.status(400);
      return { error: 'Failed to resume task or task not paused' };
    }

    return { success: true, message: 'Task resumed' };
  });

  /**
   * GET /api/master/paused-tasks
   * 获取暂停的任务列表
   */
  fastify.get('/api/master/paused-tasks', async () => {
    return {
      success: true,
      pausedTasks: exceptionHandler.getPausedTasks()
    };
  });

  // ========== 状态查询 ==========

  /**
   * GET /api/master/status/:taskId
   * 查询任务执行状态
   */
  fastify.get('/api/master/status/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };

    const task = masterAgent.getTaskStatus(taskId);
    if (!task) {
      reply.status(404);
      return { error: 'Task not found' };
    }

    const queueStatus = taskScheduler.getQueueStatus();
    const executeStates = taskExecutor.getTaskExecuteStates(taskId);

    return {
      success: true,
      status: {
        taskId: task.taskId,
        status: task.status,
        progress: task.progress,
        subtasks: task.subtasks.map(st => ({
          id: st.id,
          title: st.title,
          status: st.status,
          assignedAgentId: st.assignedAgentId
        })),
        executeStates: executeStates.map(s => ({
          subTaskId: s.subTaskId,
          status: s.status,
          progress: s.progress,
          retryCount: s.retryCount,
          error: s.error
        })),
        queueStatus
      }
    };
  });

  /**
   * GET /api/master/result/:taskId
   * 获取任务执行结果
   */
  fastify.get('/api/master/result/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };

    const task = masterAgent.getTaskResult(taskId);
    if (!task) {
      reply.status(404);
      return { error: 'Task not found' };
    }

    return {
      success: true,
      result: {
        taskId: task.taskId,
        status: task.status,
        progress: task.progress,
        summary: task.summary,
        subtasks: task.subtasks.map(st => ({
          id: st.id,
          title: st.title,
          description: st.description,
          status: st.status,
          result: st.result,
          assignedAgentId: st.assignedAgentId
        })),
        createdAt: task.createdAt,
        completedAt: task.completedAt
      }
    };
  });

  /**
   * GET /api/master/overview
   * 获取总指挥系统概览
   */
  fastify.get('/api/master/overview', async () => {
    const masterStatus = masterAgent.getStatus();
    const queueStatus = taskScheduler.getQueueStatus();
    const exceptionStats = exceptionHandler.getExceptionStats();
    const collaborationOverview = collaborationManager.getCollaborationOverview();

    return {
      success: true,
      overview: {
        master: masterStatus,
        queue: queueStatus,
        exceptions: exceptionStats,
        collaboration: collaborationOverview,
        timestamp: Date.now()
      }
    };
  });

  // ========== 控制接口 ==========

  /**
   * POST /api/master/cancel/:taskId
   * 取消任务执行
   */
  fastify.post('/api/master/cancel/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    
    const success = taskScheduler.cancelTask(taskId);
    if (!success) {
      reply.status(400);
      return { error: 'Failed to cancel task' };
    }

    return { success: true, message: 'Task cancelled' };
  });

  // ========== SSE 事件流 ==========

  /**
   * GET /api/master/stream
   * 实时获取调度器事件流
   */
  fastify.get('/api/master/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // 监听各类事件
    const onSchedulerEvent = (event: SchedulerEvent) => {
      reply.raw.write(`data: ${JSON.stringify({
        type: 'scheduler',
        event
      })}\n\n`);
    };

    const onExecuteEvent = (event: ExecuteEvent) => {
      reply.raw.write(`data: ${JSON.stringify({
        type: 'executor',
        event
      })}\n\n`);
    };

    const onCollaborationEvent = (event: CollaborationEvent) => {
      reply.raw.write(`data: ${JSON.stringify({
        type: 'collaboration',
        event
      })}\n\n`);
    };

    const onExceptionEvent = (event: ExceptionEvent) => {
      reply.raw.write(`data: ${JSON.stringify({
        type: 'exception',
        event
      })}\n\n`);
    };

    taskScheduler.on('event', onSchedulerEvent);
    taskExecutor.on('event', onExecuteEvent);
    collaborationManager.on('event', onCollaborationEvent);
    exceptionHandler.on('event', onExceptionEvent);

    // 发送心跳
    const heartbeat = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({ 
        type: 'heartbeat', 
        timestamp: Date.now(),
        queueStatus: taskScheduler.getQueueStatus()
      })}\n\n`);
    }, 30000);

    // 清理
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      taskScheduler.off('event', onSchedulerEvent);
      taskExecutor.off('event', onExecuteEvent);
      collaborationManager.off('event', onCollaborationEvent);
      exceptionHandler.off('event', onExceptionEvent);
    });
  });

  // ========== 配置接口 ==========

  /**
   * GET /api/master/config
   * 获取系统配置
   */
  fastify.get('/api/master/config', async () => {
    return {
      success: true,
      config: {
        scheduler: {
          maxConcurrency: 3,
          taskTimeoutMinutes: 10,
          retryAttempts: 2,
          retryDelaySeconds: 5
        },
        executor: {
          maxRetries: 3,
          retryDelaySeconds: 2,
          enableProgressStream: true
        },
        aggregator: {
          enableAutoAggregate: true,
          outputFormat: 'markdown'
        },
        exception: {
          autoRetryEnabled: true,
          humanInterventionThreshold: 'high',
          pauseOnCritical: true
        }
      }
    };
  });

  /**
   * POST /api/master/config
   * 更新系统配置
   */
  fastify.post('/api/master/config', async (request, reply) => {
    const config = request.body as any;

    try {
      if (config.scheduler) taskScheduler.updateConfig(config.scheduler);
      if (config.executor) taskExecutor.updateConfig(config.executor);
      if (config.aggregator) resultAggregator.updateConfig(config.aggregator);
      if (config.exception) exceptionHandler.updateConfig(config.exception);

      return { success: true, config };
    } catch (error) {
      reply.status(500);
      return {
        error: 'Failed to update config',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });
}
