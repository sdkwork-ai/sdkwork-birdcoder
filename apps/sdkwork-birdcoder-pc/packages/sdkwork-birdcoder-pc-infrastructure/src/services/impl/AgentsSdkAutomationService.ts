import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type {
  AgentAutomationRunAttemptListOptions,
  AgentAutomationRunAttemptPage,
  AgentAutomationRun,
  AgentAutomationRunListOptions,
  AgentAutomationRunPage,
  AgentAutomationTask,
  AgentAutomationTaskListOptions,
  AgentAutomationTaskPage,
  AgentAutomationTaskStateChangeRequest,
  CancelAgentAutomationRunRequest,
  CancelAgentAutomationTaskRequest,
  CreateAgentAutomationTaskRequest,
  ExecuteAgentAutomationTaskRequest,
  IAgentAutomationService,
  ReplaceAgentAutomationTaskRequest,
  RetryAgentAutomationRunRequest,
} from '../interfaces/IAgentAutomationService.ts';

export class AgentsSdkAutomationService implements IAgentAutomationService {
  constructor(private readonly client: AgentsAppSdkClient) {}

  listTasks(
    agentId: string,
    options?: AgentAutomationTaskListOptions,
  ): Promise<AgentAutomationTaskPage> {
    return this.client.ai.agents.tasks.list(agentId, options);
  }

  createTask(
    agentId: string,
    request: CreateAgentAutomationTaskRequest,
  ): Promise<AgentAutomationTask> {
    return this.client.ai.agents.tasks.create(agentId, request);
  }

  replaceTask(
    agentId: string,
    taskId: string,
    request: ReplaceAgentAutomationTaskRequest,
  ): Promise<AgentAutomationTask> {
    return this.client.ai.agents.tasks.update(agentId, taskId, request);
  }

  pauseTask(
    agentId: string,
    taskId: string,
    request: AgentAutomationTaskStateChangeRequest,
  ): Promise<AgentAutomationTask> {
    return this.client.ai.agents.tasks.pause(agentId, taskId, request);
  }

  resumeTask(
    agentId: string,
    taskId: string,
    request: AgentAutomationTaskStateChangeRequest,
  ): Promise<AgentAutomationTask> {
    return this.client.ai.agents.tasks.resume(agentId, taskId, request);
  }

  cancelTask(
    agentId: string,
    taskId: string,
    request: CancelAgentAutomationTaskRequest,
  ): Promise<AgentAutomationTask> {
    return this.client.ai.agents.tasks.cancel(agentId, taskId, request);
  }

  runTask(
    agentId: string,
    taskId: string,
    request: ExecuteAgentAutomationTaskRequest,
  ): Promise<AgentAutomationRun> {
    return this.client.ai.agents.tasks.execute(agentId, taskId, request);
  }

  listRuns(
    agentId: string,
    taskId: string,
    options?: AgentAutomationRunListOptions,
  ): Promise<AgentAutomationRunPage> {
    return this.client.ai.agents.taskRuns.list(agentId, taskId, options);
  }

  retrieveRun(
    agentId: string,
    taskId: string,
    runId: string,
  ): Promise<AgentAutomationRun> {
    return this.client.ai.agents.taskRuns.retrieve(agentId, taskId, runId);
  }

  retryRun(
    agentId: string,
    taskId: string,
    runId: string,
    request: RetryAgentAutomationRunRequest,
  ): Promise<AgentAutomationRun> {
    return this.client.ai.agents.taskRuns.retry(agentId, taskId, runId, request);
  }

  cancelRun(
    agentId: string,
    taskId: string,
    runId: string,
    request: CancelAgentAutomationRunRequest,
  ): Promise<AgentAutomationRun> {
    return this.client.ai.agents.taskRuns.cancel(agentId, taskId, runId, request);
  }

  listRunAttempts(
    agentId: string,
    taskId: string,
    runId: string,
    options?: AgentAutomationRunAttemptListOptions,
  ): Promise<AgentAutomationRunAttemptPage> {
    return this.client.ai.agents.taskRunAttempts.list(agentId, taskId, runId, options);
  }
}
