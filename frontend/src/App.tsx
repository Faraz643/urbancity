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
  { id:'207', type:'Premium Road', position:[-26,4,-4], traffic:'High', bid:8200, occupied:true, ad:'URBAN FINANCE' },
  { id:'311', type:'Street', position:[22,3,16], traffic:'Medium', bid:1800, occupied:false, ad:'AVAILABLE' },
  { id:'412', type:'Street', position:[-18,3,22], traffic:'Medium', bid:2200, occupied:false, ad:'AVAILABLE' },
];

function Building({ position, size, height, color }: {position:[number,number,number];size:[number,number];height:number;color:string}) {
  return <RigidBody type="fixed" colliders={false} position={[position[0],height/2,position[2]]}>
    <CuboidCollider args={[size[0]/2,height/2,size[1]/2]} />
    <mesh castShadow receiveShadow><boxGeometry args={[size[0], height, size[1]]} /><meshStandardMaterial color={color} roughness={0.75} metalness={0.1}/></mesh>
    <mesh position={[0,height*0.12,size[1]/2+0.01]}><planeGeometry args={[size[0]*0.75,height*0.5]}/><meshStandardMaterial color="#17233c" emissive="#1d3155" emissiveIntensity={0.35}/></mesh>
  </RigidBody>;
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

function City() {
 const buildings = useMemo(()=>[
  [-38,-25,12,10,24,'#273651'],[-20,-25,9,12,19,'#304560'],[20,-25,12,9,25,'#23334b'],[38,-24,10,12,20,'#33415c'],
  [-38,18,10,11,21,'#334155'],[-20,20,12,10,18,'#263852'],[18,22,11,11,23,'#35455f'],[38,19,9,12,17,'#26334a'],
  [-40,-2,8,8,14,'#394963'],[40,0,9,9,17,'#303e55']
 ] as const,[]);
 const treePos = useMemo(()=>Array.from({length:18},(_,i)=>[-34+(i%6)*13,0, -7+Math.floor(i/6)*13] as [number,number,number]),[]);
 return <group>
   <color attach="background" args={['#07111e']}/>
   <fog attach="fog" args={['#07111e',55,125]}/>
   <ambientLight intensity={0.55}/><directionalLight castShadow position={[20,45,20]} intensity={1.5} shadow-mapSize={[1024,1024]}/>
   <RigidBody type="fixed"><CuboidCollider args={[60,0.2,60]} position={[0,-0.2,0]}/></RigidBody>
   <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[120,120]}/><meshStandardMaterial color="#263145"/></mesh>
   <mesh position={[0,0.01,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[120,14]}/><meshStandardMaterial color="#0d1626"/></mesh>
   <mesh position={[0,0.02,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[14,120]}/><meshStandardMaterial color="#0d1626"/></mesh>
   {[-44,-28,-12,12,28,44].map(x=><mesh key={'lane'+x} position={[x,0.04,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[0.22,120]}/><meshStandardMaterial color="#c5ba67" emissive="#6f6533"/></mesh>)}
   {[-44,-28,-12,12,28,44].map(z=><mesh key={'cross'+z} position={[0,0.045,z]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[120,0.22]}/><meshStandardMaterial color="#c5ba67"/></mesh>)}
   {buildings.map(([x,z,w,d,h,c],i)=><Building key={i} position={[x,0,z]} size={[w,d]} height={h} color={c}/>)}
   {treePos.map((p,i)=><Tree key={i} position={p}/>)}
   {Array.from({length:16},(_,i)=><StreetLight key={i} position={[-48+(i%8)*14,0,i<8?-8:8]}/>)}
   <Bench position={[7,0,18]}/><Bench position={[-8,0,-17]}/>
 </group>
}
function Bench({position}:{position:[number,number,number]}) { return <RigidBody type="fixed" colliders={false} position={position}><CuboidCollider args={[1.2,.7,.45]} position={[0,.7,0]}/><mesh position={[0,.7,0]}><boxGeometry args={[2.4,.25,.7]}/><meshStandardMaterial color="#805b3b"/></mesh><mesh position={[0,1.25,.25]} rotation={[0,0,0]}><boxGeometry args={[2.4,.7,.15]}/><meshStandardMaterial color="#805b3b"/></mesh></RigidBody>}

function GameCamera(){
 const yaw=useRef(0.55), pitch=useRef(0.32), distance=useRef(12);
 const dragging=useRef(false), last=useRef<[number,number]>([0,0]);
 useEffect(()=>{
  const down=(e:MouseEvent)=>{if(e.button===2){dragging.current=true;last.current=[e.clientX,e.clientY];document.body.style.cursor='grabbing';e.preventDefault()}};
  const move=(e:MouseEvent)=>{if(!dragging.current)return;yaw.current-=e.movementX*.0045;pitch.current=THREE.MathUtils.clamp(pitch.current-e.movementY*.0035,.12,1.05)};
  const up=(e:MouseEvent)=>{if(e.button===2){dragging.current=false;document.body.style.cursor='default'}};
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
   const down=(e:KeyboardEvent)=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){pressed.current[e.code]=true;e.preventDefault()}};
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
   networkAt.current+=dt;if(networkAt.current>.08){networkAt.current=0;onMove({position:[p.x,p.y,p.z],rotation:Math.atan2(velocity.current.x,velocity.current.z),moving:velocity.current.lengthSq()>.1})}
 });
 return <RigidBody ref={body} colliders={false} position={[0,1.4,8]} enabledRotations={[false,true,false]} linearDamping={8} friction={0} mass={1}>
   <CapsuleCollider args={[0.75,0.42]}/>
   <group position={[0,-1.05,0]}><mesh castShadow><capsuleGeometry args={[0.42,1.2,6,10]}/><meshStandardMaterial color="#18a7d8"/></mesh><mesh position={[0,1.05,0.02]}><sphereGeometry args={[0.43,12,12]}/><meshStandardMaterial color="#f2c9a5"/></mesh><Text position={[0,2.05,0]} fontSize={0.28} color="white" anchorX="center">You</Text></group>
 </RigidBody>
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

function World({setNearby,players,setSelected,onMove}:{setNearby:(b:Billboard|null)=>void;players:Remote[];setSelected:(b:Billboard)=>void;onMove:(state:{position:[number,number,number];rotation:number;moving:boolean})=>void}) {
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
           <City/>
           <Player onNearby={setNearby} onMove={onMove}/>
           {MAP_BILLBOARDS.map(b=><BillboardMesh key={b.id} b={b} onSelect={setSelected}/>)}
           <RemotePlayers players={players}/>
         </Physics>
       </Suspense>
     </Canvas>
 )
}

function App(){
 const [nearby,setNearby]=useState<Billboard|null>(null),[selected,setSelected]=useState<Billboard|null>(null),[balance,setBalance]=useState(750000),[players,setPlayers]=useState<Remote[]>([]);
 const socket=useRef<Socket|null>(null);
 useEffect(()=>{const url=import.meta.env.VITE_SERVER_URL||'http://localhost:3001';const s=io(url);socket.current=s;s.on('players:list',(p:Remote[])=>setPlayers(p.filter(x=>x.id!==s.id)));s.on('player:joined',(p:Remote)=>setPlayers(a=>[...a.filter(x=>x.id!==p.id),p]));s.on('player:update',(p:Remote)=>setPlayers(a=>[...a.filter(x=>x.id!==p.id),p]));s.on('player:left',(id:string)=>setPlayers(a=>a.filter(x=>x.id!==id)));s.on('billboard:update',(b:{id:string;bid:number})=>{const local=MAP_BILLBOARDS.find(x=>x.id===b.id);if(local)local.bid=b.bid;setSelected(v=>v&&v.id===b.id?{...v,bid:b.bid}:v)});return()=>s.close()},[]);
 const bid=()=>{if(!selected)return;const next=selected.bid+500;if(balance<next)return alert('Not enough demo balance');setBalance(v=>v-next);selected.bid=next;socket.current?.emit('billboard:bid',{id:selected.id,amount:next});setSelected({...selected});};
 return <div className="app"><World setNearby={setNearby} players={players} setSelected={setSelected} onMove={(state)=>socket.current?.emit('player:update',state)}/>
  <div className="hud top"><div><b>● ONLINE</b><span>{players.length+1}</span></div><div><b>BALANCE</b><span>₹{balance.toLocaleString()}</span></div><div><b>DISTRICT</b><span>Uptown</span></div></div>
  <div className="hud controls"><b>Controls</b><small>Move <kbd>W A S D</kbd></small><small>Arrows also work</small><small>Click a billboard / interact nearby</small></div>
  <div className="minimap"><b>MAP</b><div className="mapgrid"><i/><i/><i/><i/><i/><i/><i/></div><small>🟡 billboards • 🔵 players</small></div>
  <div className="billcount">🪧 Billboards <b>{MAP_BILLBOARDS.length}</b> total</div>
  {nearby&&!selected&&<button className="interact" onClick={()=>setSelected(nearby)}>E • Interact with Billboard #{nearby.id}</button>}
  {selected&&<div className="panel"><button className="close" onClick={()=>setSelected(null)}>×</button><h2>Billboard #{selected.id}</h2><p>{selected.type} Billboard</p><div className="tag">{selected.traffic} Traffic</div><div className="stat"><span>Current Bid</span><b>₹{selected.bid.toLocaleString()}</b></div><div className="stat"><span>Minimum Next Bid</span><b>₹{(selected.bid+500).toLocaleString()}</b></div><div className="stat"><span>Status</span><b>{selected.occupied?'Occupied':'Available'}</b></div><button className="bid" onClick={bid}>Place demo bid +₹500</button><small>Virtual money only. Payment integration can replace this handler later.</small></div>}
 </div>
}
export default App;