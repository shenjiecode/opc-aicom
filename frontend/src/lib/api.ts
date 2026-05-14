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

// Helper function for API calls with credentials
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Include cookies for httpOnly cookie auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok || data.code !== 0) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
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
    const response = await fetch(`${API_BASE}/user/info`, {
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
