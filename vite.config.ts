/**
 * Purpose: Vite build and module resolution configuration.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/@mui')
            || id.includes('node_modules/@emotion')
            || id.includes('node_modules/react')
            || id.includes('node_modules/scheduler')
          ) return 'framework-vendor'
          if (id.includes('node_modules/@supabase')) return 'supabase-vendor'
          if (id.includes('node_modules/date-fns')) return 'date-vendor'
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
