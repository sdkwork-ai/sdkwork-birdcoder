import { describe, expect, it, vi } from 'vitest';
import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type {
  AgentAutomationTaskStateChangeRequest,
  CancelAgentAutomationRunRequest,
  CancelAgentAutomationTaskRequest,
  CreateAgentAutomationTaskRequest,
  ExecuteAgentAutomationTaskRequest,
  ReplaceAgentAutomationTaskRequest,
  RetryAgentAutomationRunRequest,
} from '../interfaces/IAgentAutomationService.ts';
import { AgentsSdkAutomationService } from './AgentsSdkAutomationService.ts';

describe('AgentsSdkAutomationService', () => {
  it('routes every supported Automation operation through the generated Agents App SDK', async () => {
    const listTasks = vi.fn().mockResolvedValue({ items: [] });
    const createTask = vi.fn().mockResolvedValue({ taskId: 'task-1' });
    const updateTask = vi.fn().mockResolvedValue({ taskId: 'task-1' });
    const pauseTask = vi.fn().mockResolvedValue({ taskId: 'task-1', status: 'paused' });
    const resumeTask = vi.fn().mockResolvedValue({ taskId: 'task-1', status: 'active' });
    const cancelTask = vi.fn().mockResolvedValue({ taskId: 'task-1', status: 'cancelled' });
    const executeTask = vi.fn().mockResolvedValue({ runId: 'run-1' });
    const listRuns = vi.fn().mockResolvedValue({ items: [] });
    const retrieveRun = vi.fn().mockResolvedValue({ runId: 'run-1' });
    const retryRun = vi.fn().mockResolvedValue({ runId: 'run-2' });
    const cancelRun = vi.fn().mockResolvedValue({ runId: 'run-1', status: 'cancelled' });
    const listRunAttempts = vi.fn().mockResolvedValue({ items: [] });
    const client = {
      ai: {
        agents: {
          tasks: {
            list: listTasks,
            create: createTask,
            update: updateTask,
            pause: pauseTask,
            resume: resumeTask,
            cancel: cancelTask,
            execute: executeTask,
          },
          taskRuns: {
            list: listRuns,
            retrieve: retrieveRun,
            retry: retryRun,
            cancel: cancelRun,
          },
          taskRunAttempts: {
            list: listRunAttempts,
          },
        },
      },
    } as unknown as AgentsAppSdkClient;
    const service = new AgentsSdkAutomationService(client);
    const requestedAt = '2026-07-31T12:00:00Z';
    const createRequest: CreateAgentAutomationTaskRequest = {
      sessionId: 'session-1',
      title: 'Daily review',
      prompt: 'Review the active project.',
      scheduleKind: 'cron',
      cronExpression: '0 9 * * 1-5',
      timezone: 'Asia/Shanghai',
      requestedAt,
    };
    const replaceRequest: ReplaceAgentAutomationTaskRequest = {
      title: createRequest.title,
      prompt: createRequest.prompt,
      scheduleKind: createRequest.scheduleKind,
      cronExpression: createRequest.cronExpression,
      timezone: createRequest.timezone,
      expectedVersion: '1',
      requestedAt,
    };
    const stateChangeRequest: AgentAutomationTaskStateChangeRequest = {
      expectedVersion: '1',
      requestedAt,
    };
    const cancelTaskRequest: CancelAgentAutomationTaskRequest = {
      expectedVersion: '1',
      requestedAt,
    };
    const executeRequest: ExecuteAgentAutomationTaskRequest = {
      idempotencyKey: 'run-task-1-20260731',
      expectedVersion: '1',
      requestedAt,
    };
    const retryRequest: RetryAgentAutomationRunRequest = {
      idempotencyKey: 'retry-run-1-20260731',
      requestedAt,
    };
    const cancelRunRequest: CancelAgentAutomationRunRequest = {
      expectedVersion: '1',
      requestedAt,
    };

    await service.listTasks('agent-1', { status: 'active', pageSize: 25 });
    await service.createTask('agent-1', createRequest);
    await service.replaceTask('agent-1', 'task-1', replaceRequest);
    await service.pauseTask('agent-1', 'task-1', stateChangeRequest);
    await service.resumeTask('agent-1', 'task-1', stateChangeRequest);
    await service.cancelTask('agent-1', 'task-1', cancelTaskRequest);
    await service.runTask('agent-1', 'task-1', executeRequest);
    await service.listRuns('agent-1', 'task-1', {
      status: 'failed',
      triggerKind: 'scheduled',
      pageSize: 20,
    });
    await service.retrieveRun('agent-1', 'task-1', 'run-1');
    await service.retryRun('agent-1', 'task-1', 'run-1', retryRequest);
    await service.cancelRun('agent-1', 'task-1', 'run-1', cancelRunRequest);
    await service.listRunAttempts('agent-1', 'task-1', 'run-1', { pageSize: 10 });

    expect(listTasks).toHaveBeenCalledWith('agent-1', { status: 'active', pageSize: 25 });
    expect(createTask).toHaveBeenCalledWith('agent-1', createRequest);
    expect(updateTask).toHaveBeenCalledWith('agent-1', 'task-1', replaceRequest);
    expect(pauseTask).toHaveBeenCalledWith('agent-1', 'task-1', stateChangeRequest);
    expect(resumeTask).toHaveBeenCalledWith('agent-1', 'task-1', stateChangeRequest);
    expect(cancelTask).toHaveBeenCalledWith('agent-1', 'task-1', cancelTaskRequest);
    expect(executeTask).toHaveBeenCalledWith('agent-1', 'task-1', executeRequest);
    expect(listRuns).toHaveBeenCalledWith('agent-1', 'task-1', {
      status: 'failed',
      triggerKind: 'scheduled',
      pageSize: 20,
    });
    expect(retrieveRun).toHaveBeenCalledWith('agent-1', 'task-1', 'run-1');
    expect(retryRun).toHaveBeenCalledWith('agent-1', 'task-1', 'run-1', retryRequest);
    expect(cancelRun).toHaveBeenCalledWith('agent-1', 'task-1', 'run-1', cancelRunRequest);
    expect(listRunAttempts).toHaveBeenCalledWith(
      'agent-1',
      'task-1',
      'run-1',
      { pageSize: 10 },
    );
  });
});
