const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  } catch {
    throw new ApiError('The API did not answer. Check that the API is running and retry loading.');
  }
  if (!response.ok) {
    throw new ApiError(`The API answered with status ${response.status}. Retry loading.`, response.status);
  }
  return (await response.json()) as T;
}

export async function safeGet<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch {
    return null;
  }
}

export { API_BASE };
