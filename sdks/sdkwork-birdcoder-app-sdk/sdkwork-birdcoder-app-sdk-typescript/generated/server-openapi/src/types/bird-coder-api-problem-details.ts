export interface BirdCoderApiProblemDetails {
  code: string;
  message: string;
  detail?: string;
  retryable: boolean;
  fieldErrors?: Record<string, string>;
}
