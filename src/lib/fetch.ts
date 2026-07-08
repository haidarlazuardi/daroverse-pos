export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new ApiError(json.error || 'Request failed', res.status);
  }

  return json.data as T;
}

export const api = {
  get: <T = unknown>(url: string) => apiFetch<T>(url),
  post: <T = unknown>(url: string, data: unknown) =>
    apiFetch<T>(url, { method: 'POST', body: JSON.stringify(data) }),
  put: <T = unknown>(url: string, data: unknown) =>
    apiFetch<T>(url, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T = unknown>(url: string, data: unknown) =>
    apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T = unknown>(url: string, data?: unknown) =>
    apiFetch<T>(url, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined }),
};
