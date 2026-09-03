import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// App.tsx runs its movement loop from useFrame. During R3F mount/unmount
// transitions the Rapier ref can briefly be null, so transform the exact
// movement call into a guarded call without changing gameplay logic.
const playerPhysicsGuard = () => ({
  name: 'urban-player-physics-guard',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.endsWith('/src/App.tsx')) return null
    const needle = 'body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);'
    if (!code.includes(needle)) return null
    const replacement = 'if(!body.current)return;body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);'
    return { code: code.replace(needle, replacement), map: null }
  },
})

export default defineConfig({
  plugins: [playerPhysicsGuard(), react()],
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
