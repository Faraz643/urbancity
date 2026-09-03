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
    let next = code
    const needle = 'body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);'
    if (next.includes(needle)) {
      next = next.replace(needle, 'if(!body.current)return;body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.velocity?body.current.linvel().z:velocity.current.linvel().z},true);')
    }

    // The standalone growth debugger needs the actual R3F scene. Rather than
    // relying on private canvas.__r3f internals, inject a tiny useThree bridge
    // directly inside the Canvas. This is intentionally build-time so the
    // existing App gameplay code remains untouched.
    if (!next.includes('UrbanGrowthSceneBridge')) {
      next = next.replace(
        "import { Canvas, useFrame } from '@react-three/fiber';",
        "import { Canvas, useFrame, useThree } from '@react-three/fiber';"
      )
      const marker = "import * as THREE from 'three';"
      const bridge = `\n\nfunction UrbanGrowthSceneBridge(){\n const scene=useThree((state)=>state.scene);\n useEffect(()=>{\n   (window as any).__urbanCityScene=scene;\n   return()=>{if((window as any).__urbanCityScene===scene)delete (window as any).__urbanCityScene};\n },[scene]);\n return null;\n}\n`
      next = next.replace(marker, marker + bridge)
      next = next.replace(/<Canvas([\\s\\S]*?)>/, '<Canvas$1><UrbanGrowthSceneBridge/>')
    }

    if (next === code) return null
    return { code: next, map: null }
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
