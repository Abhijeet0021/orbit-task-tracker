import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        // Without this the proxy answers an unreachable API with a bare HTML
        // 500, which the API client renders as "HTTP 500 Internal Server
        // Error" - blaming the server for not being started.
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (!res || res.writableEnded) return;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: `Cannot reach the API on http://localhost:5001 (${err.code || 'connection failed'}). Start it with "npm run dev:server", or "npm run dev" to run both.`
            }));
          });
        },
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/client'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-dnd': ['@hello-pangea/dnd'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  },
});
