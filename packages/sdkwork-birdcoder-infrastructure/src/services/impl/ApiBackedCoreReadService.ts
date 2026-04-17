import type { BirdCoderCoreReadApiClient } from '@sdkwork/birdcoder-types';
import type { ICoreReadService } from '../interfaces/ICoreReadService.ts';

export interface ApiBackedCoreReadServiceOptions {
  client: BirdCoderCoreReadApiClient;
}

export class ApiBackedCoreReadService implements ICoreReadService {
  private readonly client: BirdCoderCoreReadApiClient;

  constructor({ client }: ApiBackedCoreReadServiceOptions) {
    this.client = client;
  }

  async getCodingSession(codingSessionId: string) {
    return this.client.getCodingSession(codingSessionId);
  }

  async getDescriptor() {
    return this.client.getDescriptor();
  }

  async getEngineCapabilities(engineKey: string) {
    return this.client.getEngineCapabilities(engineKey);
  }

  async getHealth() {
    return this.client.getHealth();
  }

  async getNativeSession(codingSessionId: string, request?: Parameters<BirdCoderCoreReadApiClient['getNativeSession']>[1]) {
    return this.client.getNativeSession(codingSessionId, request);
  }

  async getOperation(operationId: string) {
    return this.client.getOperation(operationId);
  }

  async getRuntime() {
    return this.client.getRuntime();
  }

  async listCodingSessionArtifacts(codingSessionId: string) {
    return this.client.listCodingSessionArtifacts(codingSessionId);
  }

  async listCodingSessionCheckpoints(codingSessionId: string) {
    return this.client.listCodingSessionCheckpoints(codingSessionId);
  }

  async listCodingSessionEvents(codingSessionId: string) {
    return this.client.listCodingSessionEvents(codingSessionId);
  }

  async listEngines() {
    return this.client.listEngines();
  }

  async listModels() {
    return this.client.listModels();
  }

  async listNativeSessions(request?: Parameters<BirdCoderCoreReadApiClient['listNativeSessions']>[0]) {
    return this.client.listNativeSessions(request);
  }

  async listRoutes() {
    return this.client.listRoutes();
  }
}
