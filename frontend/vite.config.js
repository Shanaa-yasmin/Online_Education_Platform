import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false,
      filename: 'bundle-report.html',
      gzipSize: true,
      brotliSize: true,
    })
  ],

  build: {
    // Split big third-party libraries into their own cacheable chunks,
    // instead of one giant bundle that busts its cache on every deploy.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('recharts')) {
              return 'recharts-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
    // Raise the "chunk too large" warning threshold only if you've
    // already deliberately split things — otherwise leave it as a signal.
    chunkSizeWarningLimit: 600,
    // Drop console.log / debugger statements from production builds.
    minify: 'esbuild',
  },

  // Pre-bundle these so the dev server's first load (and reloads) are faster.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },
})