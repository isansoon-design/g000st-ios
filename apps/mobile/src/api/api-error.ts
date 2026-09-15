import { isAxiosError } from 'axios';

type ApiErrorPayload = Readonly<{
  code?: string;
  message?: string;
}>;

export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options?: Readonly<{ code?: string; status?: number }>) {
    super(message);
    this.name = 'ApiError';
    this.code = options?.code;
    this.status = options?.status;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError<ApiErrorPayload>(error)) {
    if (!error.response) {
      return new ApiError('Unable to reach g000st. Check your connection and try again.');
    }

    return new ApiError(error.response.data?.message || 'The request could not be completed.', {
      code: error.response.data?.code,
      status: error.response.status,
    });
  }

  return new ApiError(error instanceof Error ? error.message : 'Something went wrong.');
}
