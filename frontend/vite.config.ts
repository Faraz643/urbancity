import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Small development-time transforms used by the UrbanCity runtime diagnostics.
// They preserve the existing gameplay code while making the external growth
// debugger able to access the live R3F scene.
const urbanRuntimeGuard = () => ({
  name: 'urban-runtime-guard',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.endsWith('/src/App.tsx')) return null

    let next = code

    // Guard the existing Rapier movement call during mount/unmount transitions.
    const movementNeedle = 'body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);'
    const movementReplacement = 'if(!body.current)return;body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.linvel().z},true);'
    if (next.includes(movementNeedle)) next = next.replace(movementNeedle, movementReplacement)

    // The Canvas already has onCreated with access to the R3F scene. Expose
    // that exact scene object to player-growth.js; this is more reliable than
    // depending on private canvas.__r3f internals or a separate React bridge.
    const createdNeedle = 'onCreated={({gl})=>gl.setPixelRatio(Math.min(window.devicePixelRatio,1.5))}'
    const createdReplacement = 'onCreated={({gl,scene})=>{gl.setPixelRatio(Math.min(window.devicePixelRatio,1.5));(window as any).__urbanCityScene=scene}}'
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
