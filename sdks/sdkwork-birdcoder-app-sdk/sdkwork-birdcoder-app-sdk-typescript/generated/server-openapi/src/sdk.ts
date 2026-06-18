import { HttpClient, createHttpClient } from './http/client';
import type { SdkworkAppConfig } from './types/common';
import type { AuthTokenManager } from '@sdkwork/sdk-common';

import { IntelligenceApi, createIntelligenceApi } from './api/intelligence';
import { SystemApi, createSystemApi } from './api/system';
import { RuntimeApi, createRuntimeApi } from './api/runtime';
import { OauthApi, createOauthApi } from './api/oauth';
import { AuthApi, createAuthApi } from './api/auth';
import { IamApi, createIamApi } from './api/iam';
import { TemplatesApi, createTemplatesApi } from './api/templates';
import { PlatformApi, createPlatformApi } from './api/platform';
import { ContentApi, createContentApi } from './api/content';
import { SkillsApi, createSkillsApi } from './api/skills';
import { CollaborationApi, createCollaborationApi } from './api/collaboration';
import { CommerceApi, createCommerceApi } from './api/commerce';

export class SdkworkAppClient {
  private httpClient: HttpClient;

  public readonly intelligence: IntelligenceApi;
  public readonly system: SystemApi;
  public readonly runtime: RuntimeApi;
  public readonly oauth: OauthApi;
  public readonly auth: AuthApi;
  public readonly iam: IamApi;
  public readonly templates: TemplatesApi;
  public readonly platform: PlatformApi;
  public readonly content: ContentApi;
  public readonly skills: SkillsApi;
  public readonly collaboration: CollaborationApi;
  public readonly commerce: CommerceApi;

  constructor(config: SdkworkAppConfig) {
    this.httpClient = createHttpClient(config);
    this.intelligence = createIntelligenceApi(this.httpClient);

    this.system = createSystemApi(this.httpClient);

    this.runtime = createRuntimeApi(this.httpClient);

    this.oauth = createOauthApi(this.httpClient);

    this.auth = createAuthApi(this.httpClient);

    this.iam = createIamApi(this.httpClient);

    this.templates = createTemplatesApi(this.httpClient);

    this.platform = createPlatformApi(this.httpClient);

    this.content = createContentApi(this.httpClient);

    this.skills = createSkillsApi(this.httpClient);

    this.collaboration = createCollaborationApi(this.httpClient);

    this.commerce = createCommerceApi(this.httpClient);
  }
  setAuthToken(token: string): this {
    this.httpClient.setAuthToken(token);
    return this;
  }

  setAccessToken(token: string): this {
    this.httpClient.setAccessToken(token);
    return this;
  }

  setTokenManager(manager: AuthTokenManager): this {
    this.httpClient.setTokenManager(manager);
    return this;
  }

  get http(): HttpClient {
    return this.httpClient;
  }
}

export function createClient(config: SdkworkAppConfig): SdkworkAppClient {
  return new SdkworkAppClient(config);
}

export default SdkworkAppClient;
