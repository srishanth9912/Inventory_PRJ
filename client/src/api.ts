const API = (import.meta as any).env.VITE_API_URL || '';

const TOKEN_KEY = 'ifb_admin_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch { }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch { }
}

async function req(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text).error || text;
    } catch { }
    throw new Error(msg || res.statusText);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Backend server is not connected. The request returned HTML instead of data. Please set VITE_API_URL to your backend URL in Netlify.'
    );
  }

  return res.json();
}

export const api = {
  verifyCode: (code: string) =>
    req('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  login: (username: string, password: string) =>
    req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => req('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    req('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
  getHealth: () => req('/health'),
  getProducts: () => req('/products'),
  updateProduct: (id: string, data: any) =>
    req(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addStock: (productId: string, unit: string, quantity: number) =>
    req('/stock/add', {
      method: 'POST',
      body: JSON.stringify({ productId, unit, quantity }),
    }),
  getSales: (limit = 100, customerId?: string) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (customerId) q.set('customerId', customerId);
    return req(`/sales?${q.toString()}`);
  },
  createSale: (data: any) =>
    req('/sales', { method: 'POST', body: JSON.stringify(data) }),
  getStats: () => req('/stats'),
  getStockLog: (limit = 30) => req(`/stock/log?limit=${limit}`),
  getCustomers: (limit = 200) => req(`/customers?limit=${limit}`),
  createCustomer: (data: { name: string; phone?: string; notes?: string }) =>
    req('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: { name?: string; phone?: string; notes?: string }) =>
    req(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) =>
    req(`/customers/${id}`, { method: 'DELETE' }),
};

export function inr(n: number) {
  return '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN');
}

export function day(ts: number) {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function time(ts: number) {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
