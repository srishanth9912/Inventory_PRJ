// Same-origin proxy to the backend API.
// The browser calls /api/*, and this function forwards the request to the
// backend at VITE_API_URL (read at runtime, so no rebuild is needed when it
// changes). Being same-origin also avoids any CORS configuration issues.

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
]);

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req: Request) => {
  const backend = (process.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!backend) {
    return jsonError(503, 'Backend URL is not configured. Set VITE_API_URL in Netlify environment variables.');
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const target = `${backend}${path}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
    });
  } catch {
    return jsonError(502, 'Backend server is unreachable. It may be starting up — please try again in a moment.');
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (!HOP_BY_HOP.has(k) && k !== 'content-encoding' && !k.startsWith('access-control-')) {
      resHeaders.set(key, value);
    }
  });

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
};

export const config = {
  path: '/api/*',
};
