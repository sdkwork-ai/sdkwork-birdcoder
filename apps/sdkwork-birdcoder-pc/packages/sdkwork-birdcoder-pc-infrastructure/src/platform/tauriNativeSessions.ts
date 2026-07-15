import type {
  BirdCoderGetNativeSessionRequest,
  BirdCoderListNativeSessionsRequest,
  BirdCoderNativeSessionDetail,
  BirdCoderNativeSessionSummary,
} from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderRuntimeSessionPage,
} from '../services/interfaces/IAppRuntimeReadService.ts';
import type { IFileSystemService } from '../services/interfaces/IFileSystemService.ts';
import { isBirdCoderTauriRuntime } from './tauriRuntime.ts';

export interface BirdCoderNativeSessionReadPort {
  getNativeSession(
    codingSessionId: string,
    request: BirdCoderGetNativeSessionRequest,
  ): Promise<BirdCoderNativeSessionDetail | null>;
  listNativeSessionPage(
    request: BirdCoderListNativeSessionsRequest,
  ): Promise<BirdCoderRuntimeSessionPage<BirdCoderNativeSessionSummary> | null>;
}

interface TauriNativeSessionListRequest {
  engineId?: BirdCoderListNativeSessionsRequest['engineId'];
  page: number;
  pageSize: number;
  projectId: string;
  projectRoot: string;
  workspaceId: string;
}

const DEFAULT_NATIVE_SESSION_PAGE_SIZE = 20;
const MAX_NATIVE_SESSION_PAGE_SIZE = 200;

function normalizeRequiredScope(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value === undefined || value <= 0) {
    return DEFAULT_NATIVE_SESSION_PAGE_SIZE;
  }
  return Math.min(value, MAX_NATIVE_SESSION_PAGE_SIZE);
}

function normalizeOffset(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value === undefined || value < 0) {
    return 0;
  }
  return value;
}

async function invokeTauriNativeSessionCommand<T>(
  command: string,
  request: object,
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, { request });
}

async function resolveMountedRequest(
  fileSystemService: Pick<IFileSystemService, 'resolveLocalWorkingDirectory'>,
  request: BirdCoderListNativeSessionsRequest | BirdCoderGetNativeSessionRequest,
): Promise<{
  projectId: string;
  projectRoot: string;
  workspaceId: string;
} | null> {
  if (!(await isBirdCoderTauriRuntime())) {
    return null;
  }
  const projectId = normalizeRequiredScope(request?.projectId);
  const workspaceId = normalizeRequiredScope(request?.workspaceId);
  if (!projectId || !workspaceId) {
    return null;
  }
  const projectRoot = await fileSystemService.resolveLocalWorkingDirectory(projectId);
  if (!projectRoot) {
    return null;
  }
  return { projectId, projectRoot, workspaceId };
}

export function createBirdCoderTauriNativeSessionReadPort(
  fileSystemService: Pick<IFileSystemService, 'resolveLocalWorkingDirectory'>,
): BirdCoderNativeSessionReadPort {
  return {
    async getNativeSession(codingSessionId, request) {
      const mounted = await resolveMountedRequest(fileSystemService, request);
      const sessionId = normalizeRequiredScope(codingSessionId);
      if (!mounted || !sessionId) {
        return null;
      }
      return invokeTauriNativeSessionCommand<BirdCoderNativeSessionDetail>(
        'desktop_native_session_get',
        {
          ...mounted,
          engineId: request?.engineId,
          sessionId,
        },
      );
    },

    async listNativeSessionPage(request) {
      const mounted = await resolveMountedRequest(fileSystemService, request);
      if (!mounted) {
        return null;
      }
      const pageSize = normalizePageSize(request?.limit);
      const offset = normalizeOffset(request?.offset);
      const nativeRequest: TauriNativeSessionListRequest = {
        ...mounted,
        engineId: request?.engineId,
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
      };
      return invokeTauriNativeSessionCommand<
        BirdCoderRuntimeSessionPage<BirdCoderNativeSessionSummary>
      >('desktop_native_session_list', nativeRequest);
    },
  };
}
