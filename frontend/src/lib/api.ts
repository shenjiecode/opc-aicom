interface LoginResponse {
  userId: number;
  username: string;
}

interface RegisterResponse {
  userId: string;
}

interface User {
  userId: number;
  username: string;
  role: string;
  vipLevel: number;
}

interface UserInfoResponse {
  code: number;
  message: string;
  data: User | null;
}

const API_BASE = '/api';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Fetch with timeout and abort controller
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper function for API calls with credentials and timeout
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  timeout?: number
): Promise<T> {
  const response = await fetchWithTimeout(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    },
    timeout
  );

  const data = await response.json();

  if (!response.ok || data.code !== 0) {
    throw new Error(data.message || 'Request failed');
  }

  return data.data;
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>('/user/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return response;
}

export async function register(
  username: string,
  password: string,
): Promise<RegisterResponse> {
  const response = await apiRequest<RegisterResponse>('/user/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return response;
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/user/logout', {
    method: 'POST',
  });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/user/info`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data: UserInfoResponse = await response.json();

    if (response.ok && data.code === 0 && data.data) {
      return data.data;
    }

    return null;
  } catch {
    return null;
  }
}

export async function refreshToken(): Promise<{ expiresIn: number } | null> {
  try {
    const response = await apiRequest<{ expiresIn: number }>('/user/refresh', {
      method: 'POST',
    });
    return response;
  } catch {
    return null;
  }
}

// Generic fetch helper for pages that need custom API calls
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  timeout?: number
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }, timeout);
}
