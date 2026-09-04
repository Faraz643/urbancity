import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Development-time compatibility layer for the current App.tsx. This keeps
// the gameplay source untouched while exposing the real R3F scene and marking
// the actual avatar visual so the growth debugger can scale the correct object.
const urbanRuntimeGuard = () => ({
  name: 'urban-runtime-guard',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.endsWith('/src/App.tsx')) return null
    let next = code

    // Protect Rapier during the short interval in which the rigid-body ref is null.
    // velocity.current is a THREE.Vector3; linvel() belongs only to the Rapier body.
    next = next.replace(
      /body\.current\.setLinvel\(\{x:velocity\.current\.x,y:body\.current\.linvel\(\)\.y,z:velocity\.current\.linvel\(\)\.z\},true\);/g,
      'if(!body.current)return;body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);'
    )
    next = next.replace(
      /body\.current\.setLinvel\(\{x:velocity\.current\.x,y:body\.current\.linvel\(\)\.y,z:velocity\.current\.z\},true\);/g,
      'if(!body.current)return;body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);'
    )

    // Mark the real visual avatar. The growth script scales this wrapper only,
    // leaving the physics capsule at its original dimensions.
    next = next.replace(
      /<PlayerAvatar moving=\{velocity\.current\.lengthSq\(\)>\.1\}\s*\/>/g,
      '<group userData={{urbanPlayerAvatar:true}}><PlayerAvatar moving={velocity.current.lengthSq()>.1}/></group>'
    )

    // Expose the exact R3F scene from Canvas creation.
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
