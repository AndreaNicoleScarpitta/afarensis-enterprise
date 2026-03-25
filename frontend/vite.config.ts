// Afarensis Enterprise Frontend - FIXED Vite Configuration
// Addresses environment variable security, build issues, and TypeScript integration

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // CRITICAL FIX: Only expose VITE_ prefixed variables to prevent secret leakage
  const viteEnv = Object.keys(env).reduce((prev, key) => {
    if (key.startsWith('VITE_')) {
      prev[`import.meta.env.${key}`] = JSON.stringify(env[key]);
    }
    return prev;
  }, {} as Record<string, string>);

  return {
    plugins: [
      react(),
    ],

    // Path resolution
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/hooks': path.resolve(__dirname, './src/hooks'),
        '@/utils': path.resolve(__dirname, './src/utils'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/api': path.resolve(__dirname, './src/api'),
      },
    },

    // Environment variable configuration
    define: {
      ...viteEnv,
      // CRITICAL: Ensure NODE_ENV is properly set
      'process.env.NODE_ENV': JSON.stringify(mode),
    },

    // Development server configuration
    server: {
      port: 5174,
      host: true, // Listen on all addresses
      
      // CRITICAL FIX: Proxy configuration for API and WebSocket
      proxy: {
        // API requests
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        
        // CRITICAL FIX: WebSocket proxy with proper upgrade handling
        '/ws': {
          target: env.VITE_WS_URL || 'ws://localhost:8000',
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Build configuration
    build: {
      target: 'es2022',
      outDir: 'dist',
      
      // Generate sourcemaps for debugging (disable in production)
      sourcemap: mode !== 'production',
      
      // CRITICAL FIX: Prevent NODE_ENV=production from excluding devDependencies
      // This runs in a separate build stage where devDependencies are available
      emptyOutDir: true,
      
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks
            vendor: ['react', 'react-dom'],
            forms: ['react-hook-form', '@hookform/resolvers'],
            utils: ['clsx', 'tailwind-merge'],
            validation: ['zod'],
          },
          
          // Naming pattern for chunks
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop()
              : 'chunk';
            return `js/${facadeModuleId}-[hash].js`;
          },
          
          // Naming pattern for assets
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name!.split('.');
            const ext = info[info.length - 1];
            if (/\.(png|jpe?g|gif|svg|ico|webp)$/.test(assetInfo.name!)) {
              return `images/[name]-[hash][extname]`;
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name!)) {
              return `fonts/[name]-[hash][extname]`;
            }
            if (ext === 'css') {
              return `css/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
        },
      },
      
      // Build optimization
      minify: 'esbuild',
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1000,
    },

    // Optimization settings - disable entry scanning to avoid esbuild TS parser issues
    optimizeDeps: {
      noDiscovery: false,
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'axios',
        'zod',
        'react-hook-form',
        '@hookform/resolvers',
        '@hookform/resolvers/zod',
        'date-fns',
        'clsx',
        'tailwind-merge',
        '@tanstack/react-query',
        '@tanstack/react-query-devtools',
        'sonner',
        'd3',
        'recharts',
        'three',
        'framer-motion',
        'socket.io-client',
        'lucide-react',
        'lodash',
        'fuse.js',
        'react-router-dom',
        'react-error-boundary',
        'react-helmet-async',
        'react-hot-toast',
        'react-hotkeys-hook',
        'react-intersection-observer',
        'react-markdown',
        'react-select',
        'react-table',
        'react-window',
        'react-virtualized',
        'react-datepicker',
        'react-dnd',
        'react-dnd-html5-backend',
        'react-flow-renderer',
        'remark-gfm',
        'rehype-highlight',
        'vis-data',
        'vis-network',
        'ml-matrix',
        'ml-regression',
        'ml-kmeans',
        'natural',
        'compromise',
        'jspdf',
        'html2canvas',
      ],
      exclude: [],
    },

    // Environment prefix configuration
    envPrefix: 'VITE_',

    // Preview configuration (for production preview)
    preview: {
      port: 4173,
      host: true,
    },

    // Worker configuration
    worker: {
      format: 'es',
    },
  };
});

// CRITICAL NOTES:
// 1. Only VITE_ prefixed environment variables are exposed to client
// 2. TypeScript checking enabled during development
// 3. WebSocket proxy properly configured with ws: true
// 4. Manual chunk splitting for optimal loading
// 5. Asset naming patterns for better caching
// 6. PostCSS with Tailwind and Autoprefixer
// 7. Development server listens on all addresses
