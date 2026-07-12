export interface BirdCoderApiTransportErrorOptions {
  businessCode?: string;
  code?: number;
  detail?: string;
  httpStatus: number;
  method: string;
  path: string;
  traceId?: string;
}

export class BirdCoderApiTransportError extends Error {
  readonly businessCode?: string;
  readonly code?: number;
  readonly detail?: string;
  readonly httpStatus: number;
  readonly method: string;
  readonly path: string;
  readonly traceId?: string;

  constructor(options: BirdCoderApiTransportErrorOptions) {
    const detailSuffix = options.detail ? ` (${options.detail})` : '';
    super(
      `BirdCoder API request failed: ${options.method} ${options.path} -> ${options.httpStatus}${detailSuffix}`,
    );
    this.name = 'BirdCoderApiTransportError';
    this.httpStatus = options.httpStatus;
    this.method = options.method;
    this.path = options.path;
    this.detail = options.detail;
    this.code = options.code;
    this.businessCode = options.businessCode;
    this.traceId = options.traceId;
  }
}

export function readBirdCoderApiTransportErrorHttpStatus(error: unknown): number | undefined {
  if (error instanceof BirdCoderApiTransportError) {
    return error.httpStatus;
  }

  if (typeof error === 'object' && error !== null && !Array.isArray(error)) {
    const record = error as Record<string, unknown>;
    const value = record.httpStatus;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  if (error instanceof Error && error.message) {
    const match = error.message.match(/-> (\d{3})(?:\s|\(|$)/u);
    if (match) {
      return Number(match[1]);
    }
  }

  return undefined;
}
