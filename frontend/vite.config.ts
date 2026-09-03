import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Development-time runtime guard for the existing player movement call and
// a small bridge that exposes the live R3F scene to player-growth.js.
const urbanRuntimeGuard = () => ({
  name: 'urban-runtime-guard',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.endsWith('/src/App.tsx')) return null

    let next = code

    // Never call Rapier through the velocity vector. The existing gameplay
    // velocity is a plain THREE vector; only the rigid body has linvel().
    const movementNeedle = 'body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);'
    const movementReplacement = 'if(!body.current)return;body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);'
    if (next.includes(movementNeedle)) next = next.replace(movementNeedle, movementReplacement)

    // Match the current Canvas callback exactly and expose the R3F scene.
    // The growth script only reads this reference; it does not alter the
    // renderer or the React tree.
    const createdNeedle = 'onCreated={({gl})=>gl.setPixelRatio(Math.min(window.devicePixelRatio,1.5))}'
    const createdReplacement = 'onCreated={({gl,scene})=>{gl.setPixelRatio(Math.min(window.devicePixelRatio,1.5));window.__urbanCityScene=scene}}'
    if (next.includes(createdNeedle)) next = next.replace(createdNeedle, createdReplacement)

    if (next === code) return null
    return { code: next, map: null }
  },
})

export default defineConfig({
  plugins: [urbanRuntimeGuard(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
