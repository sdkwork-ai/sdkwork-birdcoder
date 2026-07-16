import { stringifyBirdCoderApiJson } from '@sdkwork/birdcoder-pc-types';
import {
  CurrentUserScopeResolver,
  type CurrentUserScope,
} from '../currentUserScope.ts';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { IAppRuntimeReadService } from '../interfaces/IAppRuntimeReadService.ts';
import type { BirdCoderAppRuntimeReadSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedAppRuntimeReadServiceOptions {
  client: BirdCoderAppRuntimeReadSdkApiClient;
  currentUserProvider?: Pick<IAuthService, 'getCurrentUser'>;
}

interface ReadCacheEntry<T> {
  expiresAt: number;
  inflight: Promise<T> | null;
  value?: T;
}

interface UserScopedCacheKey {
  cacheable: boolean;
  key: string;
}

const INFLIGHT_ONLY_TTL_MS = 0;
// Authoritative session transcripts must stay fresh. A short TTL here can cause
// newly created turns or recently selected sessions to resolve against stale
// summaries/events and appear empty in the chat surface.
const SESSION_DETAIL_TTL_MS = INFLIGHT_ONLY_TTL_MS;
const SESSION_INVENTORY_TTL_MS = 10_000;
const STATIC_CATALOG_TTL_MS = 30_000;
const APP_RUNTIME_READ_CACHE_MAX_ENTRIES = 256;

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

export class ApiBackedAppRuntimeReadService implements IAppRuntimeReadService {
  readonly codingSessionListIncludesNativeSessions = true;
  private readonly client: BirdCoderAppRuntimeReadSdkApiClient;
  private readonly currentUserScopeResolver: CurrentUserScopeResolver;
  private readonly readCache = new Map<string, ReadCacheEntry<unknown>>();

  constructor({
    client,
    currentUserProvider,
  }: ApiBackedAppRuntimeReadServiceOptions) {
    this.client = client;
    this.currentUserScopeResolver = new CurrentUserScopeResolver({
      currentUserProvider,
    });
  }

  private async resolveCurrentUserScope(): Promise<CurrentUserScope> {
    return this.currentUserScopeResolver.resolve();
  }

  private async buildUserScopedCacheKey(
    scope: string,
    payload?: unknown,
  ): Promise<UserScopedCacheKey> {
    const userScope = await this.resolveCurrentUserScope();
    return {
      cacheable: userScope.cacheable,
      key: this.buildCacheKey(scope, {
        payload: payload ?? null,
        userId: userScope.userId,
      }),
    };
  }

  private buildCacheKey(scope: string, payload?: unknown): string {
    return `${scope}:${stableSerializeCacheKeyPart(payload ?? null)}`;
  }

  private pruneReadCache(now: number = Date.now()): void {
    for (const [cacheKey, entry] of this.readCache) {
      if (entry.inflight) {
        continue;
      }

      if (entry.expiresAt <= now) {
        this.readCache.delete(cacheKey);
      }
    }

    while (this.readCache.size > APP_RUNTIME_READ_CACHE_MAX_ENTRIES) {
      let evictedEntry = false;
      for (const [cacheKey, entry] of this.readCache) {
        if (entry.inflight) {
          continue;
        }

        this.readCache.delete(cacheKey);
        evictedEntry = true;
        break;
      }

      if (!evictedEntry) {
        break;
      }
    }
  }

  private readThroughCache<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    this.pruneReadCache(now);
    const cachedEntry = this.readCache.get(key) as ReadCacheEntry<T> | undefined;

    if (cachedEntry?.inflight) {
      return cachedEntry.inflight;
    }

    if (cachedEntry && ttlMs > 0 && cachedEntry.value !== undefined && cachedEntry.expiresAt > now) {
      this.readCache.delete(key);
      this.readCache.set(key, cachedEntry as ReadCacheEntry<unknown>);
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
          this.pruneReadCache();
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
    this.pruneReadCache();

    return request;
  }

  async getCodingSession(codingSessionId: string) {
    const cacheKey = await this.buildUserScopedCacheKey('getCodingSession', codingSessionId);
    return this.readThroughCache(
      cacheKey.key,
      cacheKey.cacheable ? SESSION_DETAIL_TTL_MS : INFLIGHT_ONLY_TTL_MS,
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

  async getNativeSession(codingSessionId: string, request: Parameters<BirdCoderAppRuntimeReadSdkApiClient['getNativeSession']>[1]) {
    const cacheKey = await this.buildUserScopedCacheKey('getNativeSession', {
      codingSessionId,
      request,
    });
    return this.readThroughCache(
      cacheKey.key,
      cacheKey.cacheable ? SESSION_DETAIL_TTL_MS : INFLIGHT_ONLY_TTL_MS,
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
    const cacheKey = await this.buildUserScopedCacheKey(
      'listCodingSessionArtifacts',
      codingSessionId,
    );
    return this.readThroughCache(
      cacheKey.key,
      INFLIGHT_ONLY_TTL_MS,
      () => this.client.listCodingSessionArtifacts(codingSessionId),
    );
  }

  async listCodingSessionCheckpoints(codingSessionId: string) {
    const cacheKey = await this.buildUserScopedCacheKey(
      'listCodingSessionCheckpoints',
      codingSessionId,
    );
    return this.readThroughCache(
      cacheKey.key,
      INFLIGHT_ONLY_TTL_MS,
      () => this.client.listCodingSessionCheckpoints(codingSessionId),
    );
  }

  async listCodingSessionEvents(codingSessionId: string) {
    const cacheKey = await this.buildUserScopedCacheKey('listCodingSessionEvents', codingSessionId);
    return this.readThroughCache(
      cacheKey.key,
      cacheKey.cacheable ? SESSION_DETAIL_TTL_MS : INFLIGHT_ONLY_TTL_MS,
      () => this.client.listCodingSessionEvents(codingSessionId),
    );
  }

  async listCodingSessions(request?: Parameters<BirdCoderAppRuntimeReadSdkApiClient['listCodingSessions']>[0]) {
    const cacheKey = await this.buildUserScopedCacheKey('listCodingSessions', request);
    return this.readThroughCache(
      cacheKey.key,
      cacheKey.cacheable ? SESSION_INVENTORY_TTL_MS : INFLIGHT_ONLY_TTL_MS,
      () => this.client.listCodingSessions(request),
    );
  }

  async listCodingSessionPage(
    request?: Parameters<BirdCoderAppRuntimeReadSdkApiClient['listCodingSessionPage']>[0],
  ) {
    const cacheKey = await this.buildUserScopedCacheKey('listCodingSessionPage', request);
    return this.readThroughCache(
      cacheKey.key,
      cacheKey.cacheable ? SESSION_INVENTORY_TTL_MS : INFLIGHT_ONLY_TTL_MS,
      () => this.client.listCodingSessionPage(request),
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

  async getModelConfig() {
    return this.readThroughCache(
      this.buildCacheKey('getModelConfig'),
      STATIC_CATALOG_TTL_MS,
      () => this.client.getModelConfig(),
    );
  }

  async listNativeSessionProviders() {
    return this.readThroughCache(
      this.buildCacheKey('listNativeSessionProviders'),
      STATIC_CATALOG_TTL_MS,
      () => this.client.listNativeSessionProviders(),
    );
  }

  async listNativeSessions(request: Parameters<BirdCoderAppRuntimeReadSdkApiClient['listNativeSessions']>[0]) {
    const cacheKey = await this.buildUserScopedCacheKey('listNativeSessions', request);
    return this.readThroughCache(
      cacheKey.key,
      cacheKey.cacheable ? SESSION_INVENTORY_TTL_MS : INFLIGHT_ONLY_TTL_MS,
      () => this.client.listNativeSessions(request),
    );
  }

  async listNativeSessionPage(
    request: Parameters<BirdCoderAppRuntimeReadSdkApiClient['listNativeSessionPage']>[0],
  ) {
    const cacheKey = await this.buildUserScopedCacheKey('listNativeSessionPage', request);
    return this.readThroughCache(
      cacheKey.key,
      cacheKey.cacheable ? SESSION_INVENTORY_TTL_MS : INFLIGHT_ONLY_TTL_MS,
      () => this.client.listNativeSessionPage(request),
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
