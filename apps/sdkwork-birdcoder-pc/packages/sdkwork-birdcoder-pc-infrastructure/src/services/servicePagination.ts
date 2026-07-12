import type {
  BirdCoderServiceOffsetPageInfo,
  BirdCoderServicePageRequest,
} from './interfaces/IProjectService.ts';

const MAX_SERVICE_PAGE_SIZE = 200;
const MAX_SERVICE_PAGE_OFFSET = 200_000;

export interface ResolvedBirdCoderServicePageRequest extends BirdCoderServicePageRequest {
  offset: number;
}

export function resolveBirdCoderServicePageRequest(
  request: BirdCoderServicePageRequest,
): ResolvedBirdCoderServicePageRequest {
  if (!Number.isSafeInteger(request.page) || request.page < 1) {
    throw new Error('Page must be a positive safe integer.');
  }
  if (
    !Number.isSafeInteger(request.pageSize) ||
    request.pageSize < 1 ||
    request.pageSize > MAX_SERVICE_PAGE_SIZE
  ) {
    throw new Error(`Page size must be an integer between 1 and ${MAX_SERVICE_PAGE_SIZE}.`);
  }

  const offset = (request.page - 1) * request.pageSize;
  if (!Number.isSafeInteger(offset) || offset > MAX_SERVICE_PAGE_OFFSET) {
    throw new Error('Page exceeds the supported offset range.');
  }

  return {
    ...request,
    offset,
  };
}

export function createBirdCoderServiceOffsetPageInfo(
  request: BirdCoderServicePageRequest,
  totalItems: number,
): BirdCoderServiceOffsetPageInfo {
  const resolvedRequest = resolveBirdCoderServicePageRequest(request);
  if (!Number.isSafeInteger(totalItems) || totalItems < 0) {
    throw new Error('Total items must be a non-negative safe integer.');
  }

  const totalPages = Math.ceil(totalItems / resolvedRequest.pageSize);
  return {
    hasMore: resolvedRequest.page < totalPages,
    mode: 'offset',
    page: resolvedRequest.page,
    pageSize: resolvedRequest.pageSize,
    totalItems: String(totalItems),
    totalPages,
  };
}
