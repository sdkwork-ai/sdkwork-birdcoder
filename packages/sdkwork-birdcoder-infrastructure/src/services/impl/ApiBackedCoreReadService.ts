import {
  stringifyBirdCoderApiJson,
  type BirdCoderCoreReadApiClient,
} from '@sdkwork/birdcoder-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { ICoreReadService } from '../interfaces/ICoreReadService.ts';

export interface ApiBackedCoreReadServiceOptions {
  client: BirdCoderCoreReadApiClient;
  identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
}

interface ReadCacheEntry<T> {
  expiresAt: number;
  inflight: Promise<T> | null;
  value?: T;
}

const INFLIGHT_ONLY_TTL_MS = 0;
// Authoritative session transcripts must stay fresh. A short TTL here can cause
// newly created turns or recently selected sessions to resolve against stale
// summaries/events and appear empty in the chat surface.
const SESSION_DETAIL_TTL_MS = INFLIGHT_ONLY_TTL_MS;
const SESSION_INVENTORY_TTL_MS = 10_000;
const STATIC_CATALOG_TTL_MS = 30_000;

function stableSerializeCacheKeyPart(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerializeCacheKeyPart(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${stringifyBirdCoderApiJson(key)}:${stableSerializeCacheKeyPart(entryValue)}`,
      )
      .join(',')}}`;
  }

  return stringifyBirdCoderApiJson(value);
}

export class ApiBackedCoreReadService implements ICoreReadService {
  private readonly client: BirdCoderCoreReadApiClient;
  private readonly identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
  private readonly readCache = new Map<string, ReadCacheEntry<unknown>>();

  constructor({ client, identityProvider }: ApiBackedCoreReadServiceOptions) {
    this.client = client;
    this.identityProvider = identityProvider;
  }

  private async resolveCurrentUserScope(): Promise<string> {
    const user = await this.identityProvider?.getCurrentUser();
    const userId = user?.id?.trim();
    return userId && userId.length > 0 ? userId : 'anonymous';
  }

  private async buildUserScopedCacheKey(scope: string, payload?: unknown): Promise<string> {
    const userScope = await this.resolveCurrentUserScope();
    return this.buildCacheKey(scope, {
      payload: payload ?? null,
      userId: userScope,
    });
  }

  private buildCacheKey(scope: string, payload?: unknown): string {
    return `${scope}:${stableSerializeCacheKeyPart(payload ?? null)}`;
  }

  private readThroughCache<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const cachedEntry = this.readCache.get(key) as ReadCacheEntry<T> | undefined;

    if (cachedEntry?.inflight) {
      return cachedEntry.inflight;
    }

    if (cachedEntry && ttlMs > 0 && cachedEntry.value !== undefined && cachedEntry.expiresAt > now) {
      return Promise.resolve(cachedEntry.value);
    }

    const request = loader()
      .then((value) => {
        if (ttlMs > 0) {
          this.readCache.set(key, {
            expiresAt: Date.now() + ttlMs,
            inflight: null,
            value,
          });
        } else {
          this.readCache.delete(key);
        }
        return value;
      })
      .catch((error) => {
        this.readCache.delete(key);
        throw error;
      });

    this.readCache.set(key, {
      expiresAt: now + ttlMs,
      inflight: request,
      value: cachedEntry?.value,
    });

    return request;
  }

  async getCodingSession(codingSessionId: string) {
    const key = await this.buildUserScopedCacheKey('getCodingSession', codingSessionId);
    return this.readThroughCache(
      key,
      SESSION_DETAIL_TTL_MS,
      () => this.client.getCodingSession(codingSessionId),
    );
  }

  async getDescriptor() {
    return this.readThroughCache(
      this.buildCacheKey('getDescriptor'),
      STATIC_CATALOG_TTL_MS,
      () => this.client.getDescriptor(),
    );
  }

  async getEngineCapabilities(engineKey: string) {
    return this.readThroughCache(
      this.buildCacheKey('getEngineCapabilities', engineKey),
      STATIC_CATALOG_TTL_MS,
      () => this.client.getEngineCapabilities(engineKey),
    );
  }

  async getHealth() {
    return this.client.getHealth();
  }

  async getNativeSession(codingSessionId: string, request?: Parameters<BirdCoderCoreReadApiClient['getNativeSession']>[1]) {
    const key = await this.buildUserScopedCacheKey('getNativeSession', {
      codingSessionId,
      request,
    });
    return this.readThroughCache(
      key,
      SESSION_DETAIL_TTL_MS,
      () => this.client.getNativeSession(codingSessionId, request),
    );
  }

  async getOperation(operationId: string) {
    return this.client.getOperation(operationId);
  }

  async getRuntime() {
    return this.readThroughCache(
      this.buildCacheKey('getRuntime'),
      STATIC_CATALOG_TTL_MS,
      () => this.client.getRuntime(),
    );
  }

  async listCodingSessionArtifacts(codingSessionId: string) {
    const key = await this.buildUserScopedCacheKey(
      'listCodingSessionArtifacts',
      codingSessionId,
    );
    return this.readThroughCache(
      key,
      INFLIGHT_ONLY_TTL_MS,
      () => this.client.listCodingSessionArtifacts(codingSessionId),
    );
  }

  async listCodingSessionCheckpoints(codingSessionId: string) {
    const key = await this.buildUserScopedCacheKey(
      'listCodingSessionCheckpoints',
      codingSessionId,
    );
    return this.readThroughCache(
      key,
      INFLIGHT_ONLY_TTL_MS,
      () => this.client.listCodingSessionCheckpoints(codingSessionId),
    );
  }

  async listCodingSessionEvents(codingSessionId: string) {
    const key = await this.buildUserScopedCacheKey('listCodingSessionEvents', codingSessionId);
    return this.readThroughCache(
      key,
      SESSION_DETAIL_TTL_MS,
      () => this.client.listCodingSessionEvents(codingSessionId),
    );
  }

  async listCodingSessions(request?: Parameters<BirdCoderCoreReadApiClient['listCodingSessions']>[0]) {
    const key = await this.buildUserScopedCacheKey('listCodingSessions', request);
    return this.readThroughCache(
      key,
      SESSION_INVENTORY_TTL_MS,
      () => this.client.listCodingSessions(request),
    );
  }

  async listEngines() {
    return this.readThroughCache(
      this.buildCacheKey('listEngines'),
      STATIC_CATALOG_TTL_MS,
      () => this.client.listEngines(),
    );
  }

  async listModels() {
    return this.readThroughCache(
      this.buildCacheKey('listModels'),
      STATIC_CATALOG_TTL_MS,
      () => this.client.listModels(),
    );
  }

  async listNativeSessionProviders() {
    return this.readThroughCache(
      this.buildCacheKey('listNativeSessionProviders'),
      STATIC_CATALOG_TTL_MS,
      () => this.client.listNativeSessionProviders(),
    );
  }

  async listNativeSessions(request?: Parameters<BirdCoderCoreReadApiClient['listNativeSessions']>[0]) {
    const key = await this.buildUserScopedCacheKey('listNativeSessions', request);
    return this.readThroughCache(
      key,
      SESSION_INVENTORY_TTL_MS,
      () => this.client.listNativeSessions(request),
    );
  }

  async listRoutes() {
    return this.readThroughCache(
      this.buildCacheKey('listRoutes'),
      STATIC_CATALOG_TTL_MS,
      () => this.client.listRoutes(),
    );
  }
}
