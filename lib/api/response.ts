import { ApiResponse } from './types';

export const createApiResponse = <T>(
  data: T,
  success = true
): ApiResponse<T> => ({
  success,
  data,
  meta: {
    timestamp: new Date().toISOString(),
    requestId: '' // Optionally set a request ID here
  }
});

export const createErrorResponse = (
  code: string,
  message: string,
  details?: unknown
): ApiResponse<never> => ({
  success: false,
  error: { code, message, details },
  meta: {
    timestamp: new Date().toISOString(),
    requestId: '' // Optionally set a request ID here
  }
}); 