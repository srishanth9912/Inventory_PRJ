const API = (import.meta as any).env.VITE_API_URL || '';
const KEY = (import.meta as any).env.VITE_API_KEY || '';

async function req(path: string, options: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': KEY,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text).error || text;
    } catch {}
    throw new Error(msg || res.statusText);
  }
  return res.json();
}

export const api = {
  getProducts: () => req('/products'),
  updateProduct: (id: string, data: any) =>
    req(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addStock: (productId: string, unit: string, quantity: number) =>
    req('/stock/add', {
      method: 'POST',
      body: JSON.stringify({ productId, unit, quantity }),
    }),
  getSales: (limit = 100) => req(`/sales?limit=${limit}`),
  createSale: (data: any) =>
    req('/sales', { method: 'POST', body: JSON.stringify(data) }),
  getStats: () => req('/stats'),
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
