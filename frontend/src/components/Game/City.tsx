import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useMemo } from 'react';
import type { Billboard } from '../../types/billboard';
import { TIME_THEMES, type TimeMode } from '../../lib/timeTheme';
import { Bench } from './Bench';
import { Building } from './Building';
import { StreetLight } from './StreetLight';
import { ThemedSky } from './ThemedSky';
import { Tree } from './Tree';
import { WorldFence } from './WorldFence';
import { RoadLayout } from './RoadLayout';

export type { TimeMode } from '../../lib/timeTheme';
export { TIME_THEMES } from '../../lib/timeTheme';

export function City({timeMode,billboards=[]}:{timeMode:TimeMode;billboards?:Billboard[]}) {
 const theme=TIME_THEMES[timeMode];
 const buildings=useMemo(()=>[
  [-31,-43,16,13,34,'#182536'],[-20,-42,8,15,28,'#1c2a3b'],[20,-43,9,15,32,'#172436'],[32,-42,17,14,38,'#1b2839'],[-34,-19,18,12,36,'#1a2738'],[-20,-17,9,12,27,'#202e40'],[20,-18,10,13,31,'#19283a'],[34,-18,18,13,40,'#162334'],[-33,9,17,14,42,'#182536'],[-20,11,9,12,30,'#202e40'],[20,10,10,12,34,'#1b293a'],[34,11,18,13,44,'#172436'],[-34,39,18,14,39,'#1a2738'],[-20,40,9,14,29,'#202e40'],[20,39,10,14,35,'#182536'],[34,40,18,14,41,'#172436'],[-49,-29,12,10,24,'#26364a'],[49,-29,12,10,25,'#233247']
 ] as const,[]);
 const treePos=useMemo(()=>[
  [-14,0,-45],[-14,0,-5],[-14,0,18],[-14,0,45],[14,0,-45],[14,0,-5],[14,0,18],[14,0,45],[-25,0,-31],[25,0,-31]
 ].filter(([x,,z])=>!billboards.some(b=>Math.hypot(x-b.position[0],z-b.position[2])<7)) as [number,number,number][],[billboards]);
 return <group>
  <color attach="background" args={[theme.bg]}/><fog attach="fog" args={[theme.fog,75,155]}/><ambientLight intensity={theme.ambient}/><directionalLight castShadow position={theme.sunPos} intensity={theme.sun} color={theme.sunColor} shadow-mapSize={[1024,1024]}/>
  <RigidBody type="fixed"><CuboidCollider args={[70,.2,70]} position={[0,-.2,0]}/></RigidBody><ThemedSky timeMode={timeMode}/><mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[120,120]}/><meshStandardMaterial color={theme.ground}/></mesh><WorldFence/>
  <RoadLayout timeMode={timeMode}/>
  {buildings.map(([x,z,w,d,h,col],i)=><Building key={i} position={[x,0,z]} size={[w,d]} height={h} color={col}/>)}{treePos.map((p,i)=><Tree key={i} position={p}/>)}{Array.from({length:12},(_,i)=><StreetLight key={i} position={[i%2?-12:12,0,-48+Math.floor(i/2)*18]}/>)}<Bench position={[-13,0,26]}/><Bench position={[13,0,-8]}/>
 </group>;
}
