import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderBooleanSuccessEnvelope, BirdCoderIamCreateSessionRequest, BirdCoderIamPasswordResetCreateRequest, BirdCoderIamPasswordResetRequestCreateRequest, BirdCoderIamRefreshSessionRequest, BirdCoderIamRegistrationCreateRequest, BirdCoderIamSessionEnvelope, BirdCoderIamUpdateCurrentSessionRequest } from '../types';


export class AuthSessionsCurrentApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get current SDKWork IAM session */
  async retrieve(): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.get<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/sessions/current`));
  }

/** Update current SDKWork IAM session */
  async update(body?: BirdCoderIamUpdateCurrentSessionRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.patch<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/sessions/current`), body, undefined, undefined, 'application/json');
  }

/** Delete current SDKWork IAM session */
  async delete(): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.delete<BirdCoderBooleanSuccessEnvelope>(appApiPath(`/auth/sessions/current`));
  }
}

export class AuthSessionsApi {
  private client: HttpClient;
  public readonly current: AuthSessionsCurrentApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.current = new AuthSessionsCurrentApi(client);
  }


/** Create SDKWork IAM session */
  async create(body: BirdCoderIamCreateSessionRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/sessions`), body, undefined, undefined, 'application/json');
  }

/** Refresh SDKWork IAM session */
  async refresh(body: BirdCoderIamRefreshSessionRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/sessions/refresh`), body, undefined, undefined, 'application/json');
  }
}

export class AuthRegistrationsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Register SDKWork IAM user */
  async create(body: BirdCoderIamRegistrationCreateRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/registrations`), body, undefined, undefined, 'application/json');
  }
}

export class AuthPasswordResetsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Reset SDKWork IAM password */
  async create(body: BirdCoderIamPasswordResetCreateRequest): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.post<BirdCoderBooleanSuccessEnvelope>(appApiPath(`/auth/password_resets`), body, undefined, undefined, 'application/json');
  }
}

export class AuthPasswordResetRequestsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create SDKWork IAM password reset request */
  async create(body: BirdCoderIamPasswordResetRequestCreateRequest): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.post<BirdCoderBooleanSuccessEnvelope>(appApiPath(`/auth/password_reset_requests`), body, undefined, undefined, 'application/json');
  }
}

export class AuthApi {
  private client: HttpClient;
  public readonly passwordResetRequests: AuthPasswordResetRequestsApi;
  public readonly passwordResets: AuthPasswordResetsApi;
  public readonly registrations: AuthRegistrationsApi;
  public readonly sessions: AuthSessionsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.passwordResetRequests = new AuthPasswordResetRequestsApi(client);
    this.passwordResets = new AuthPasswordResetsApi(client);
    this.registrations = new AuthRegistrationsApi(client);
    this.sessions = new AuthSessionsApi(client);
  }

}

export function createAuthApi(client: HttpClient): AuthApi {
  return new AuthApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}
