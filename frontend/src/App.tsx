import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';

type Billboard = { id:string; type:'Premium Road'|'Street'; position:[number,number,number]; traffic:'High'|'Medium'; bid:number; occupied:boolean; ad:string };
type Remote = { id:string; name:string; position:[number,number,number]; rotation:number; moving:boolean };

const MAP_BILLBOARDS: Billboard[] = [
  { id:'102', type:'Premium Road', position:[0,4,-22], traffic:'High', bid:5000, occupied:false, ad:'ZEST • meal delivery' },
  { id:'207', type:'Premium Road', position:[0,4,22], traffic:'High', bid:8200, occupied:true, ad:'URBAN FINANCE' },
  { id:'311', type:'Street', position:[28,3,-14], traffic:'Medium', bid:1800, occupied:false, ad:'AVAILABLE' },
  { id:'412', type:'Street', position:[-28,3,4], traffic:'Medium', bid:2200, occupied:false, ad:'AVAILABLE' },
];

function Building({ position, size, height, color }: { position: [number, number, number]; size: [number, number]; height: number; color: string }) {
  const cols = Math.max(2, Math.floor(size[0] / 2));
  const rows = Math.max(4, Math.floor(height / 3.2));
  const windows: Array<[number, number, number, number]> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      windows.push([
        (col - (cols - 1) / 2) * (size[0] / cols),
        1.6 + row * (height / (rows + 1)),
        row,
        col
      ]);
    }
  }

  return (
    <RigidBody type="fixed" colliders={false} position={[position[0], height / 2, position[2]]}>
      <CuboidCollider args={[size[0] / 2, height / 2, size[1] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size[0], height, size[1]]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.16} />
      </mesh>

      <mesh position={[0, -height / 2 + 2.1, size[1] / 2 + 0.025]}>
        <boxGeometry args={[size[0] * 0.82, 2.7, 0.08]} />
        <meshStandardMaterial color="#0a1320" metalness={0.35} />
      </mesh>
      <mesh position={[0, -height / 2 + 2.25, size[1] / 2 + 0.08]}>
        <planeGeometry args={[size[0] * 0.62, 1.55]} />
        <meshStandardMaterial color="#203b54" emissive="#1d5272" emissiveIntensity={0.55} />
      </mesh>

      {windows.map(([x, y, row, col], i) => (
        <mesh key={i} position={[x, y - height / 2, size[1] / 2 + 0.035]}>
          <planeGeometry args={[Math.max(0.35, (size[0] / cols) * 0.48), Math.max(0.55, (height / (rows + 1)) * 0.46)]} />
          <meshStandardMaterial
            color={row % 3 === 0 ? "#384a5d" : "#253547"}
            emissive={(row + col) % 4 === 0 ? "#d6c878" : "#37526d"}
            emissiveIntensity={(row + col) % 4 === 0 ? 0.7 : 0.35}
          />
        </mesh>
      ))}

      <mesh position={[0, height * 0.48, 0]}>
        <boxGeometry args={[size[0] * 1.03, 0.35, size[1] * 1.03]} />
        <meshStandardMaterial color="#111c2a" metalness={0.35} />
      </mesh>
      {height > 32 && (
        <mesh position={[0, height * 0.53, 0]}>
          <boxGeometry args={[size[0] * 0.32, 3, size[1] * 0.28]} />
          <meshStandardMaterial color="#202d3e" roughness={0.65} />
        </mesh>
      )}
    </RigidBody>
  );
}

function Tree({position}:{position:[number,number,number]}) {
  return <RigidBody type="fixed" colliders={false} position={position}>
    <CuboidCollider args={[0.55,2,0.55]} position={[0,2,0]}/>
    <mesh castShadow position={[0,1.6,0]}><cylinderGeometry args={[0.22,0.32,3.2,8]}/><meshStandardMaterial color="#5d4631"/></mesh>
    <mesh castShadow position={[0,4.1,0]}><sphereGeometry args={[1.7,10,10]}/><meshStandardMaterial color="#185d46"/></mesh>
  </RigidBody>
}

function StreetLight({position}:{position:[number,number,number]}) {
 return <group position={position}><mesh position={[0,2.4,0]}><cylinderGeometry args={[0.08,0.11,4.8,8]}/><meshStandardMaterial color="#263040"/></mesh><pointLight position={[0,4.7,0]} intensity={9} distance={14} color="#ffeab0"/><mesh position={[0,4.7,0]}><sphereGeometry args={[0.18,8,8]}/><meshStandardMaterial emissive="#ffeab0" color="#fff5c9" emissiveIntensity={2}/></mesh></group>
}

type TimeMode = 'morning' | 'evening' | 'night';

const TIME_THEMES: Record<TimeMode,{bg:string;fog:string;ground:string;road:string;ambient:number;sun:number;sunColor:string;sunPos:[number,number,number]}>={
 morning:{bg:'#a8cbe0',fog:'#b7d6e6',ground:'#718b79',road:'#303842',ambient:1.05,sun:2.0,sunColor:'#fff0cf',sunPos:[-35,45,25]},
 evening:{bg:'#9b6b72',fog:'#a77a79',ground:'#52605c',road:'#252934',ambient:.72,sun:1.45,sunColor:'#ffb27a',sunPos:[35,22,-25]},
 night:{bg:'#07111e',fog:'#07111e',ground:'#172233',road:'#090f1a',ambient:.5,sun:1.45,sunColor:'#dcecff',sunPos:[25,55,18]}
};

function City({timeMode}:{timeMode:TimeMode}) {
 // Dense boulevard layout inspired by the supplied reference: a long central avenue,
 // one major cross street, continuous sidewalks and tall street-wall buildings.
 const theme=TIME_THEMES[timeMode];
 const buildings = useMemo(()=>[
  [-31,-43,16,13,34,'#182536'],[-20,-42,8,15,28,'#1c2a3b'],[20,-43,9,15,32,'#172436'],[32,-42,17,14,38,'#1b2839'],
  [-34,-19,18,12,36,'#1a2738'],[-20,-17,9,12,27,'#202e40'],[20,-18,10,13,31,'#19283a'],[34,-18,18,13,40,'#162334'],
  [-33,9,17,14,42,'#182536'],[-20,11,9,12,30,'#202e40'],[20,10,10,12,34,'#1b293a'],[34,11,18,13,44,'#172436'],
  [-34,39,18,14,39,'#1a2738'],[-20,40,9,14,29,'#202e40'],[20,39,10,14,35,'#182536'],[34,40,18,14,41,'#172436'],
  [-49,-29,12,10,24,'#26364a'],[49,-29,12,10,25,'#233247']
 ] as const,[]);
 const treePos = useMemo(()=>[
   [-14,0,-45],[-14,0,-5],[-14,0,18],[-14,0,45],
   [14,0,-45],[14,0,-5],[14,0,18],[14,0,45],
   [-25,0,-31],[25,0,-31]
 ].filter(([x,,z])=>!MAP_BILLBOARDS.some(b=>Math.hypot(x-b.position[0],z-b.position[2])<7)) as [number,number,number][],[]);
 return <group>
   <color attach="background" args={[theme.bg]}/>
   <fog attach="fog" args={[theme.fog,75,155]}/>
   <ambientLight intensity={theme.ambient}/><directionalLight castShadow position={theme.sunPos} intensity={theme.sun} color={theme.sunColor} shadow-mapSize={[1024,1024]}/>
   <RigidBody type="fixed"><CuboidCollider args={[60,.2,60]} position={[0,-.2,0]}/></RigidBody>
   <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[120,120]}/><meshStandardMaterial color={theme.ground}/></mesh>

   {/* Main avenue and intersection */}
   <mesh position={[0,.01,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[18,120]}/><meshStandardMaterial color={theme.road} roughness={.9}/></mesh>
   <mesh position={[0,.012,-29]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[120,14]}/><meshStandardMaterial color="#090f1a" roughness={.9}/></mesh>
   <mesh position={[-10,.025,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,120]}/><meshStandardMaterial color="#46505b"/></mesh>
   <mesh position={[10,.025,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,120]}/><meshStandardMaterial color="#46505b"/></mesh>

   {/* Long boulevard lane markings */}
   {[-4.5,4.5].map((x,i)=>Array.from({length:12},(_,j)=><mesh key={i+'-'+j} position={[x,.045,-52+j*9]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.18,4.2]}/><meshStandardMaterial color="#d7c95e" emissive="#655c27"/></mesh>))}
   <mesh position={[0,.05,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.12,120]}/><meshStandardMaterial color="#9d9348"/></mesh>
   <mesh position={[0,.05,-36]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[120,.18]}/><meshStandardMaterial color="#d7c95e"/></mesh>

   {/* Crosswalk at the main intersection */}
   {Array.from({length:7},(_,i)=><mesh key={'cw'+i} position={[-6+i*2,.06,-21.7]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.15,4]}/><meshStandardMaterial color="#d6d9d6"/></mesh>)}

   {buildings.map(([x,z,w,d,h,col],i)=><Building key={i} position={[x,0,z]} size={[w,d]} height={h} color={col}/>)}
   {treePos.map((p,i)=><Tree key={i} position={p}/>)}
   {Array.from({length:12},(_,i)=><StreetLight key={i} position={[i%2?-12:12,0,-48+Math.floor(i/2)*18]}/>)}
   <Bench position={[-13,0,26]}/><Bench position={[13,0,-8]}/>
 </group>
}

function Bench({position}:{position:[number,number,number]}) { return <RigidBody type="fixed" colliders={false} position={position}><CuboidCollider args={[1.2,.7,.45]} position={[0,.7,0]}/><mesh position={[0,.7,0]}><boxGeometry args={[2.4,.25,.7]}/><meshStandardMaterial color="#805b3b"/></mesh><mesh position={[0,1.25,.25]} rotation={[0,0,0]}><boxGeometry args={[2.4,.7,.15]}/><meshStandardMaterial color="#805b3b"/></mesh></RigidBody>}

function GameCamera(){
 const yaw=useRef(0.55), pitch=useRef(0.32), distance=useRef(12);
 const dragging=useRef(false), last=useRef<[number,number]>([0,0]);
 useEffect(()=>{
  const down=(e:MouseEvent)=>{if(e.button===0){dragging.current=true;last.current=[e.clientX,e.clientY];document.body.style.cursor='grabbing';e.preventDefault()}};
  const move=(e:MouseEvent)=>{if(!dragging.current)return;yaw.current-=e.movementX*.0045;pitch.current=THREE.MathUtils.clamp(pitch.current+e.movementY*.0035,.12,1.05)};
  const up=(e:MouseEvent)=>{if(e.button===0){dragging.current=false;document.body.style.cursor='default'}};
  const menu=(e:MouseEvent)=>e.preventDefault();
  const wheel=(e:WheelEvent)=>{distance.current=THREE.MathUtils.clamp(distance.current+e.deltaY*.012,4.5,20)};
  window.addEventListener('mousedown',down);window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);window.addEventListener('contextmenu',menu);window.addEventListener('wheel',wheel,{passive:true});
  return()=>{window.removeEventListener('mousedown',down);window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);window.removeEventListener('contextmenu',menu);window.removeEventListener('wheel',wheel)};
 },[]);
 useFrame(({camera},dt)=>{
  const p=(window as any).__urbanPlayerPosition as THREE.Vector3|undefined;if(!p)return;
  const target=new THREE.Vector3(p.x,p.y+1.2,p.z);
  const horizontal=Math.cos(pitch.current)*distance.current;
  (window as any).__urbanCameraYaw=yaw.current;
  const desired=new THREE.Vector3(target.x+Math.sin(yaw.current)*horizontal,target.y+Math.sin(pitch.current)*distance.current,target.z+Math.cos(yaw.current)*horizontal);
  camera.position.lerp(desired,1-Math.pow(.0001,dt));camera.lookAt(target);
 });
 return null;
}

function Player({onNearby,onMove}:{onNearby:(b:Billboard|null)=>void;onMove:(state:{position:[number,number,number];rotation:number;moving:boolean})=>void}) {
 const body = useRef<RapierRigidBody>(null!);
 const pressed = useRef<Record<string, boolean>>({});
 useEffect(()=>{
   const down=(e:KeyboardEvent)=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){pressed.current[e.code]=true;e.preventDefault()};if(e.code==='KeyE'){const b=(window as any).__urbanNearbyBillboard as Billboard|null;if(b){e.preventDefault();onNearby(b);(window as any).__urbanInteractBillboard?.(b)}}};
   const up=(e:KeyboardEvent)=>{pressed.current[e.code]=false};
   window.addEventListener('keydown',down,{passive:false});
   window.addEventListener('keyup',up);
   return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)};
 },[]);
 const velocity = useRef(new THREE.Vector3());
 const target = useRef(new THREE.Vector3());
 const networkAt = useRef(0);
 useFrame((_,dt)=>{
   const k=pressed.current;
   const inputX=((k.KeyD||k.ArrowRight)?1:0)-((k.KeyA||k.ArrowLeft)?1:0);
   const inputZ=((k.KeyS||k.ArrowDown)?1:0)-((k.KeyW||k.ArrowUp)?1:0);
   const dir=new THREE.Vector3(inputX,0,inputZ);
   const yaw=(window as any).__urbanCameraYaw ?? 0;
   if(dir.lengthSq()>0){dir.normalize();dir.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);}
   const speed=7; velocity.current.lerp(dir.multiplyScalar(speed),Math.min(1,dt*12));
   body.current.setLinvel({x:velocity.current.x,y:body.current.linvel().y,z:velocity.current.z},true);
   const p=body.current.translation();
   if(velocity.current.lengthSq()>0.1){ const angle=Math.atan2(velocity.current.x,velocity.current.z); body.current.setRotation({x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)},true); }
   target.current.set(p.x,p.y,p.z);
   (window as any).__urbanPlayerPosition=target.current.clone();
   let nearest:Billboard|null=null,dist=Infinity;
   for(const b of MAP_BILLBOARDS){const d=Math.hypot(p.x-b.position[0],p.z-b.position[2]);if(d<5&&d<dist){nearest=b;dist=d}}
   onNearby(nearest);
   (window as any).__urbanNearbyBillboard=nearest;
   networkAt.current+=dt;if(networkAt.current>.08){networkAt.current=0;onMove({position:[p.x,p.y,p.z],rotation:Math.atan2(velocity.current.x,velocity.current.z),moving:velocity.current.lengthSq()>.1})}
 });
 return <RigidBody ref={body} colliders={false} position={[0,1.4,8]} enabledRotations={[false,true,false]} linearDamping={8} friction={0} mass={1}>
   <CapsuleCollider args={[0.75,0.42]}/>
   <group position={[0,-1.05,0]}><mesh castShadow><capsuleGeometry args={[0.42,1.2,6,10]}/><meshStandardMaterial color="#18a7d8"/></mesh><mesh position={[0,1.05,0.02]}><sphereGeometry args={[0.43,12,12]}/><meshStandardMaterial color="#f2c9a5"/></mesh><Text position={[0,2.05,0]} fontSize={0.28} color="white" anchorX="center">You</Text></group>
 </RigidBody>
}

function BillboardPad({b}:{b:Billboard}) {
 const premium=b.type==='Premium Road';
 return <group position={[b.position[0],0.015,b.position[2]]}>
   <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[premium?11:8,premium?3.2:2.8]}/><meshStandardMaterial color="#303b4c"/></mesh>
   <mesh position={[0,.012,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[premium?10.2:7.2,.12]}/><meshStandardMaterial color="#e0bf52" emissive="#6f6533"/></mesh>
 </group>
}

function BillboardMesh({b,onSelect}:{b:Billboard;onSelect:(b:Billboard)=>void}) {
 const w=b.type==='Premium Road'?9:6,h=b.type==='Premium Road'?4.6:3;
 return <RigidBody type="fixed" colliders={false} position={b.position}>
   <CuboidCollider args={[w/2,h/2,0.35]} />
   <group onClick={(e)=>{e.stopPropagation();onSelect(b)}}><mesh position={[0,0,0]}><boxGeometry args={[w,h,.45]}/><meshStandardMaterial color="#111827"/></mesh><mesh position={[0,0,.24]}><planeGeometry args={[w-.35,h-.35]}/><meshStandardMaterial color={b.occupied?'#5b2038':'#294c0b'} emissive={b.occupied?'#3b0c21':'#234d03'} emissiveIntensity={0.7}/></mesh><Text position={[0,.2,.48]} fontSize={h*.18} color="white" anchorX="center">{b.ad}</Text><Text position={[0,-h*.28,.48]} fontSize={.22} color="#b8d9ff" anchorX="center">#{b.id} • ₹{b.bid.toLocaleString()}</Text></group>
   <mesh position={[-w*.28,-h/2-2,0]}><boxGeometry args={[.25,4,.25]}/><meshStandardMaterial color="#171c25"/></mesh><mesh position={[w*.28,-h/2-2,0]}><boxGeometry args={[.25,4,.25]}/><meshStandardMaterial color="#171c25"/></mesh>
 </RigidBody>
}

function RemoteAvatar({p}:{p:Remote}) { const ref=useRef<THREE.Group>(null!); useFrame((_,dt)=>{ref.current.position.lerp(new THREE.Vector3(...p.position),1-Math.pow(.001,dt));ref.current.rotation.y=THREE.MathUtils.lerp(ref.current.rotation.y,p.rotation,Math.min(1,dt*10))}); return <group ref={ref} position={p.position}><mesh castShadow position={[0,1,0]}><capsuleGeometry args={[.38,1.1,5,8]}/><meshStandardMaterial color="#f59e0b"/></mesh><Text position={[0,2.1,0]} fontSize={.25} color="white" anchorX="center">{p.name}</Text></group> }
function RemotePlayers({players}:{players:Remote[]}) { return <>{players.map(p=><RemoteAvatar key={p.id} p={p}/>)}</> }

function World({setNearby,players,setSelected,onMove,timeMode}:{setNearby:(b:Billboard|null)=>void;players:Remote[];setSelected:(b:Billboard)=>void;onMove:(s:Remote)=>void;timeMode:TimeMode}):{setNearby:(b:Billboard|null)=>void;players:Remote[];setSelected:(b:Billboard)=>void;onMove:(state:{position:[number,number,number];rotation:number;moving:boolean})=>void}) {
 return (
     <Canvas
       shadows
       camera={{position:[10,9,21],fov:55}}
       dpr={[1,1.5]}
       gl={{antialias:true,powerPreference:'high-performance'}}
       onCreated={({gl})=>gl.setPixelRatio(Math.min(window.devicePixelRatio,1.5))}
     >
       <Suspense fallback={null}>
         <GameCamera/><Physics gravity={[0,-20,0]}>
           <City timeMode={timeMode}/>
           <Player onNearby={setNearby} onMove={onMove}/>
           {MAP_BILLBOARDS.map(b=><group key={b.id}><BillboardPad b={b}/><BillboardMesh b={b} onSelect={setSelected}/></group>)}
           <RemotePlayers players={players}/>
         </Physics>
       </Suspense>
     </Canvas>
 )
}

function MiniMap({players}:{players:Remote[]}) {
 const [me,setMe]=useState<[number,number,number]>([0,0,8]);
 const [yaw,setYaw]=useState(0);
 useEffect(()=>{let id=0;const tick=()=>{const p=(window as any).__urbanPlayerPosition as THREE.Vector3|undefined;if(p)setMe([p.x,p.y,p.z]);setYaw((window as any).__urbanCameraYaw??0);id=requestAnimationFrame(tick)};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)},[]);
 const toPct=(x:number,z:number)=>({left:`${Math.max(3,Math.min(97,(x+60)/120*100))}%`,top:`${Math.max(3,Math.min(97,(z+60)/120*100))}%`});
 return <div className="minimap"><div className="maptitle"><b>LIVE MAP</b><span>● LIVE</span></div><div className="mapgrid">
   <div className="map-road vertical"/><div className="map-road horizontal"/>
   {[-44,-28,-12,12,28,44].map((v,i)=><div key={'rv'+i} className="minor-road v" style={{left:`${(v+60)/120*100}%`}}/>)}
   {[-44,-28,-12,12,28,44].map((v,i)=><div key={'rh'+i} className="minor-road h" style={{top:`${(v+60)/120*100}%`}}/>)}
   {MAP_BILLBOARDS.map(b=><i key={b.id} className="map-billboard" title={`Billboard #${b.id}`} style={toPct(b.position[0],b.position[2])}/>)}
   {players.map(p=><i key={p.id} className="map-player" style={toPct(p.position[0],p.position[2])}/>)}
   <i className="map-me" style={{...toPct(me[0],me[2]),transform:`translate(-50%,-50%) rotate(${yaw}rad)`}}/>
 </div><small>🟡 billboards &nbsp; 🔵 players &nbsp; 🟢 you</small></div>
}

function App(){
 const [nearby,setNearby]=useState<Billboard|null>(null),[selected,setSelected]=useState<Billboard|null>(null),[balance,setBalance]=useState(750000),[players,setPlayers]=useState<Remote[]>([]),[timeMode,setTimeMode]=useState<TimeMode>('night');
 const socket=useRef<Socket|null>(null);
 useEffect(()=>{const url=import.meta.env.VITE_SERVER_URL||'http://localhost:3001';const s=io(url);socket.current=s;s.on('players:list',(p:Remote[])=>setPlayers(p.filter(x=>x.id!==s.id)));s.on('player:joined',(p:Remote)=>setPlayers(a=>[...a.filter(x=>x.id!==p.id),p]));s.on('player:update',(p:Remote)=>setPlayers(a=>[...a.filter(x=>x.id!==p.id),p]));s.on('player:left',(id:string)=>setPlayers(a=>a.filter(x=>x.id!==id)));s.on('billboard:update',(b:{id:string;bid:number})=>{const local=MAP_BILLBOARDS.find(x=>x.id===b.id);if(local)local.bid=b.bid;setSelected(v=>v&&v.id===b.id?{...v,bid:b.bid}:v)});return()=>s.close()},[]);
 useEffect(()=>{(window as any).__urbanInteractBillboard=(b:Billboard)=>setSelected(b);return()=>{delete (window as any).__urbanInteractBillboard;delete (window as any).__urbanNearbyBillboard}},[]);
 const bid=()=>{if(!selected)return;const next=selected.bid+500;if(balance<next)return alert('Not enough demo balance');setBalance(v=>v-next);selected.bid=next;socket.current?.emit('billboard:bid',{id:selected.id,amount:next});setSelected({...selected});};
 return <div className="app"><World setNearby={setNearby} players={players} setSelected={setSelected} onMove={(state)=>socket.current?.emit('player:update',state)} timeMode={timeMode}/>
  <div className="hud top"><div><b>● ONLINE</b><span>{players.length+1}</span></div><div><b>BALANCE</b><span>₹{balance.toLocaleString()}</span></div><div><b>DISTRICT</b><span>Uptown</span></div></div>
  <div className="time-switcher"><b>TIME</b>{(["morning","evening","night"] as TimeMode[]).map(m=><button key={m} className={timeMode===m?"active":""} onClick={()=>setTimeMode(m)}>{m}</button>)}</div><div className="hud controls"><b>Controls</b><small>Move <kbd>W A S D</kbd></small><small>Arrows also work</small><small><kbd>E</kbd> interact nearby • click billboard</small></div>
  <MiniMap players={players}/>
  <div className="billcount">🪧 Billboards <b>{MAP_BILLBOARDS.length}</b> total</div>
  {nearby&&!selected&&<button className="interact" onClick={()=>setSelected(nearby)}>E • Interact with Billboard #{nearby.id}</button>}
  {selected&&<div className="panel"><button className="close" onClick={()=>setSelected(null)}>×</button><h2>Billboard #{selected.id}</h2><p>{selected.type} Billboard</p><div className="tag">{selected.traffic} Traffic</div><div className="stat"><span>Current Bid</span><b>₹{selected.bid.toLocaleString()}</b></div><div className="stat"><span>Minimum Next Bid</span><b>₹{(selected.bid+500).toLocaleString()}</b></div><div className="stat"><span>Status</span><b>{selected.occupied?'Occupied':'Available'}</b></div><button className="bid" onClick={bid}>Place demo bid +₹500</button><small>Virtual money only. Payment integration can replace this handler later.</small></div>}
 </div>
}
export default App;