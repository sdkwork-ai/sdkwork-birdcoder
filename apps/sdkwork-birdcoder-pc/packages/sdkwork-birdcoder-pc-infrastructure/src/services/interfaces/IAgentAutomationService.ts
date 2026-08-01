import type {
  AgentTaskRecord,
  AgentTaskRunAttemptRecord,
  AgentTaskRunRecord,
  AgentTaskStateChangeRequest,
  AgentsAppSdkClient,
  CancelAgentTaskRequest,
  CancelAgentTaskRunRequest,
  CreateAgentTaskRequest,
  ExecuteAgentTaskRequest,
  ReplaceAgentTaskRequest,
  RetryAgentTaskRunRequest,
  SdkWorkPageData,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

export type AgentAutomationTask = AgentTaskRecord;
export type AgentAutomationRun = AgentTaskRunRecord;
export type AgentAutomationRunAttempt = AgentTaskRunAttemptRecord;
export type AgentAutomationTaskListOptions = NonNullable<
  Parameters<AgentsAppSdkClient['ai']['agents']['tasks']['list']>[1]
>;
export type AgentAutomationRunListOptions = NonNullable<
  Parameters<AgentsAppSdkClient['ai']['agents']['taskRuns']['list']>[2]
>;
export type AgentAutomationRunAttemptListOptions = NonNullable<
  Parameters<AgentsAppSdkClient['ai']['agents']['taskRunAttempts']['list']>[3]
>;
export type CreateAgentAutomationTaskRequest = CreateAgentTaskRequest;
export type ReplaceAgentAutomationTaskRequest = ReplaceAgentTaskRequest;
export type AgentAutomationTaskStateChangeRequest = AgentTaskStateChangeRequest;
export type CancelAgentAutomationTaskRequest = CancelAgentTaskRequest;
export type ExecuteAgentAutomationTaskRequest = ExecuteAgentTaskRequest;
export type RetryAgentAutomationRunRequest = RetryAgentTaskRunRequest;
export type CancelAgentAutomationRunRequest = CancelAgentTaskRunRequest;

export type AgentAutomationTaskPage = SdkWorkPageData & {
  items: AgentAutomationTask[];
};

export type AgentAutomationRunPage = SdkWorkPageData & {
  items: AgentAutomationRun[];
};

export type AgentAutomationRunAttemptPage = SdkWorkPageData & {
  items: AgentAutomationRunAttempt[];
};

export interface IAgentAutomationService {
  listTasks(
    agentId: string,
    options?: AgentAutomationTaskListOptions,
  ): Promise<AgentAutomationTaskPage>;
  createTask(
    agentId: string,
    request: CreateAgentAutomationTaskRequest,
  ): Promise<AgentAutomationTask>;
  replaceTask(
    agentId: string,
    taskId: string,
    request: ReplaceAgentAutomationTaskRequest,
  ): Promise<AgentAutomationTask>;
  pauseTask(
    agentId: string,
    taskId: string,
    request: AgentAutomationTaskStateChangeRequest,
  ): Promise<AgentAutomationTask>;
  resumeTask(
    agentId: string,
    taskId: string,
    request: AgentAutomationTaskStateChangeRequest,
  ): Promise<AgentAutomationTask>;
  cancelTask(
    agentId: string,
    taskId: string,
    request: CancelAgentAutomationTaskRequest,
  ): Promise<AgentAutomationTask>;
  runTask(
    agentId: string,
    taskId: string,
    request: ExecuteAgentAutomationTaskRequest,
  ): Promise<AgentAutomationRun>;
  listRuns(
    agentId: string,
    taskId: string,
    options?: AgentAutomationRunListOptions,
  ): Promise<AgentAutomationRunPage>;
  retrieveRun(
    agentId: string,
    taskId: string,
    runId: string,
  ): Promise<AgentAutomationRun>;
  retryRun(
    agentId: string,
    taskId: string,
    runId: string,
    request: RetryAgentAutomationRunRequest,
  ): Promise<AgentAutomationRun>;
  cancelRun(
    agentId: string,
    taskId: string,
    runId: string,
    request: CancelAgentAutomationRunRequest,
  ): Promise<AgentAutomationRun>;
  listRunAttempts(
    agentId: string,
    taskId: string,
    runId: string,
    options?: AgentAutomationRunAttemptListOptions,
  ): Promise<AgentAutomationRunAttemptPage>;
}
