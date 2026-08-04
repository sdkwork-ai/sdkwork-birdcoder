import { MAX_LIST_PAGE_SIZE, normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

export interface OffsetListPageRequestInput {
  page?: number | null;
  pageSize?: number | null;
}

/**
 * Normalizes an offset-list page request with SDKWork rejection semantics
 * (`PAGINATION_SPEC.md` §10.1 / `API_SPEC.md` §16.2): a page below 1 or a
 * page size above the declared maximum is a caller bug and must fail loudly
 * instead of being silently clamped. The shared `normalizeOffsetListQuery`
 * utility clamps for tolerance; this wrapper restores the rejection contract
 * at the service boundary so out-of-bounds parameters are never masked.
 */
export function normalizeOffsetListPageRequest(
  request: OffsetListPageRequestInput = {},
): { page: number; pageSize: number } {
  const page = typeof request.page === 'number' ? request.page : undefined;
  const pageSize = typeof request.pageSize === 'number' ? request.pageSize : undefined;
  if (page !== undefined && (!Number.isSafeInteger(page) || page < 1)) {
    throw new Error(
      `page must be a positive integer, received: ${JSON.stringify(page)}`,
    );
  }
  if (
    pageSize !== undefined
    && (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_LIST_PAGE_SIZE)
  ) {
    throw new Error(
      `page_size must be an integer between 1 and ${MAX_LIST_PAGE_SIZE}, received: ${JSON.stringify(pageSize)}`,
    );
  }
  const { page: normalizedPage, page_size: normalizedPageSize } = normalizeOffsetListQuery({
    page,
    page_size: pageSize,
  });
  return { page: normalizedPage, pageSize: normalizedPageSize };
}
