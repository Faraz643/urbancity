import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Clean player-growth integration layer.
 * main/App.tsx remains the source-of-truth gameplay file; this transform injects
 * growth data into its existing player and camera paths without replacing them.
 */
function playerGrowthIntegration() {
  return {
    name: 'urbancity-player-growth-integration',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.replace(/\\/g, '/').endsWith('/src/App.tsx')) return null
      let out = code
      if (!out.includes("from './player-growth-react'")) {
        out = out.replace("import { io, Socket } from 'socket.io-client';", "import { io, Socket } from 'socket.io-client';\nimport { GrowingPlayerAvatar, GrowthNameTag, PLAYER_BASE_HEIGHT } from './player-growth-react';")
      }
      out = out.replace("type Remote = { id:string; name:string; position:[number,number,number]; rotation:number; moving:boolean };", "type Remote = { id:string; name:string; position:[number,number,number]; rotation:number; moving:boolean; height:number };")
      out = out.replace('function GameCamera(){', 'function GameCamera({playerHeight=PLAYER_BASE_HEIGHT}:{playerHeight?:number}){')
      out = out.replace("  const rawTarget=new THREE.Vector3(p.x,3.1,p.z);", "  const safeHeight=Math.max(PLAYER_BASE_HEIGHT,Number(playerHeight)||PLAYER_BASE_HEIGHT);\n  const heightOffset=Math.min(safeHeight-PLAYER_BASE_HEIGHT,30);\n  const rawTarget=new THREE.Vector3(p.x,3.1+heightOffset*0.34,p.z);")
      out = out.replace("  const horizontal=Math.max(2.2,Math.cos(pitch.current)*distance.current);", "  const adaptiveDistance=distance.current+heightOffset*0.32;\n  const horizontal=Math.max(2.2,Math.cos(pitch.current)*adaptiveDistance);")
      out = out.replace("  const desired=new THREE.Vector3(target.x+Math.sin(yaw.current)*horizontal,target.y+Math.sin(pitch.current)*distance.current,target.z+Math.cos(yaw.current)*horizontal);", "  const desired=new THREE.Vector3(target.x+Math.sin(yaw.current)*horizontal,target.y+Math.sin(pitch.current)*adaptiveDistance,target.z+Math.cos(yaw.current)*horizontal);\n  desired.y=Math.max(1.15,desired.y);")
      out = out.replace('function Player({onNearby,onMove,onPosition,onFootfallEnter,onFootfallLeave}:{onNearby:(b:Billboard|null)=>void;onMove:(state:{position:[number,number,number];rotation:number;moving:boolean})=>void;onPosition:(p:[number,number,number])=>void;onFootfallEnter:(id:string)=>void;onFootfallLeave:(id:string)=>void}) {', 'function Player({onNearby,onMove,onPosition,onFootfallEnter,onFootfallLeave,height=PLAYER_BASE_HEIGHT}:{onNearby:(b:Billboard|null)=>void;onMove:(state:{position:[number,number,number];rotation:number;moving:boolean})=>void;onPosition:(p:[number,number,number])=>void;onFootfallEnter:(id:string)=>void;onFootfallLeave:(id:string)=>void;height?:number}) {')
      out = out.replace('   <PlayerAvatar moving={velocity.current.lengthSq()>.1}/>\n   <Text position={[0,1.85,0]} fontSize={0.28} color="white" anchorX="center">You</Text>', '   <GrowingPlayerAvatar height={height}>\n     <PlayerAvatar moving={velocity.current.lengthSq()>.1}/>\n   </GrowingPlayerAvatar>\n   <GrowthNameTag name="You" height={height}/>')
      out = out.replace('   <PlayerAvatar moving={moving.current}/>\n   <Text position={[0,1.85,0]} fontSize={.25} color="white" anchorX="center" outlineWidth={0.015} outlineColor="#07111e">{p.name}</Text>', '   <GrowingPlayerAvatar height={p.height}>\n     <PlayerAvatar moving={moving.current}/>\n   </GrowingPlayerAvatar>\n   <GrowthNameTag name={p.name} height={p.height}/>')
      out = out.replace('  onLocalPosition: (p: [number, number, number]) => void;\n  bidders:', '  onLocalPosition: (p: [number, number, number]) => void;\n  localPlayerHeight: number;\n  bidders:')
      out = out.replace('<GameCamera/><Physics', '<GameCamera playerHeight={localPlayerHeight}/><Physics')
      out = out.replace('<Player onNearby={setNearby} onMove={onMove} onPosition={onLocalPosition} onFootfallEnter={onFootfallEnter} onFootfallLeave={onFootfallLeave}/>', '<Player height={localPlayerHeight} onNearby={setNearby} onMove={onMove} onPosition={onLocalPosition} onFootfallEnter={onFootfallEnter} onFootfallLeave={onFootfallLeave}/>')
      out = out.replace(" const [nearby,setNearby]=useState<Billboard|null>(null),[selected,setSelected]=useState<Billboard|null>(null),[balance,setBalance]=useState(750000),[players,setPlayers]=useState<Remote[]>([]),[timeMode,setTimeMode]=useState<TimeMode>('evening'),[localPosition,setLocalPosition]=useState<[number,number,number]>([0,1.4,8]);", " const [nearby,setNearby]=useState<Billboard|null>(null),[selected,setSelected]=useState<Billboard|null>(null),[balance,setBalance]=useState(750000),[players,setPlayers]=useState<Remote[]>([]),[timeMode,setTimeMode]=useState<TimeMode>('evening'),[localPosition,setLocalPosition]=useState<[number,number,number]>([0,1.4,8]),[localPlayerHeight,setLocalPlayerHeight]=useState(PLAYER_BASE_HEIGHT);")
      out = out.replace("s.on('players:list',(p:Remote[])=>setPlayers(p.filter(x=>x.id!==s.id)));s.on('player:joined',(p:Remote)=>setPlayers(a=>[...a.filter(x=>x.id!==p.id),p]));s.on('player:update',(p:Remote)=>setPlayers(a=>[...a.filter(x=>x.id!==p.id),p]));s.on('player:left',(id:string)=>setPlayers(a=>a.filter(x=>x.id!==id)));", "s.on('players:list',(p:Remote[])=>setPlayers(p.filter(x=>x.id!==s.id)));s.on('player:self',(p:Remote)=>{if(p&&typeof p.height==='number')setLocalPlayerHeight(p.height);});s.on('players:heights',(list:Remote[])=>{const mine=list.find(x=>x.id===s.id);if(mine&&typeof mine.height==='number')setLocalPlayerHeight(mine.height);setPlayers(a=>a.map(old=>{const next=list.find(x=>x.id===old.id);return next?{...old,...next}:old;}));});s.on('player:joined',(p:Remote)=>setPlayers(a=>[...a.filter(x=>x.id!==p.id),p]));s.on('player:update',(p:Remote)=>setPlayers(a=>[...a.filter(x=>x.id!==p.id),p]));s.on('player:left',(id:string)=>setPlayers(a=>a.filter(x=>x.id!==id)));" )
      out = out.replace('<World setNearby={setNearby} players={players}', '<World setNearby={setNearby} players={players} localPlayerHeight={localPlayerHeight}')
      return { code: out, map: null }
    },
  }
}

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