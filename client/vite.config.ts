import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  target: 'http://localhost:8787',
  changeOrigin: true,
  headers: { origin: 'http://localhost:5173' },
  configure: (proxy: any) => {
    proxy.on('error', (_err: any, _req: any, res: any) => {
      if (!res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend server is not running on port 8787. Please start the server.' }));
      }
    });
  },
};

const productsProxy = {
  ...apiProxy,
  bypass: (req: any) => {
    const pathname = (req.url || '').split('?')[0];
    if (/\.(jpg|jpeg|png|svg|webp|gif|ico|avif)$/i.test(pathname)) {
      return req.url;
    }
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/auth': apiProxy,
      '/products': productsProxy,
      '/stock': apiProxy,
      '/sales': apiProxy,
      '/stats': apiProxy,
      '/health': apiProxy,
      '/customers': apiProxy,
      '/db': apiProxy,
    },
  },
});

