import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Player growth is now a normal part of the React/socket player pipeline.
// This small source transform only wires the existing PlayerAvatar instances to
// the reusable GrowingPlayerAvatar wrapper, so the large legacy App.tsx can stay
// otherwise unchanged. No scene traversal, global THREE object, or physics-body
// scaling is used.
const playerGrowthIntegration = () => ({
  name: 'urban-player-growth-integration',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.endsWith('/src/App.tsx')) return null
    let next = code

    next = next.replace(
      "import { Canvas, useFrame } from '@react-three/fiber';",
      "import { Canvas, useFrame } from '@react-three/fiber';\nimport { GrowingPlayerAvatar } from './player-growth-react';"
    )

    next = next.replace(
      'type Remote = { id:string; name:string; position:[number,number,number]; rotation:number; moving:boolean };',
      'type Remote = { id:string; name:string; position:[number,number,number]; rotation:number; moving:boolean; height?:number };'
    )

    // Local player: height arrives through the authoritative player:self socket event.
    next = next.replace(
      '<PlayerAvatar moving={velocity.current.lengthSq()>.1}/>',
      '<GrowingPlayerAvatar height={Number((window as any).__urbanLocalPlayerHeight)||2.8}><PlayerAvatar moving={velocity.current.lengthSq()>.1}/></GrowingPlayerAvatar>'
    )

    // Remote players: height is carried by the same socket snapshot as position.
    next = next.replace(
      '<PlayerAvatar moving={moving.current}/>',
      '<GrowingPlayerAvatar height={Number(p.height)||2.8}><PlayerAvatar moving={moving.current}/></GrowingPlayerAvatar>'
    )

    // The old growth feature used a separate scene scanner. Keep the visible
    // player names for normal gameplay; growth is now represented by the avatar
    // itself and is no longer coupled to text-object discovery.
    const socketNeedle = 'const s=io(api,{auth:token?{token}:{}});'
    const socketReplacement = "const s=io(api,{auth:token?{token}:{}});s.on('player:self',(p:any)=>{(window as any).__urbanLocalPlayerHeight=Math.min(44,Math.max(2.8,Number(p?.height)||2.8));});"
    if (next.includes(socketNeedle)) next = next.replace(socketNeedle, socketReplacement)

    // Remove the previous unsafe Rapier runtime transform. The Player component
    // is left as source code and the normal R3F lifecycle is used.
    if (next === code) return null
    return { code: next, map: null }
  },
})

export default defineConfig({
  plugins: [playerGrowthIntegration(), react()],
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
