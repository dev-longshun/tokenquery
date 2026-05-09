import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import semiPlugin from '@douyinfe/vite-plugin-semi';

export default defineConfig({
  plugins: [react(), semiPlugin.vitePluginSemi({ cssLayer: true })],
  build: {
    outDir: '../cmd/server/webdist',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:18080',
        changeOrigin: true,
      },
    },
  },
});
