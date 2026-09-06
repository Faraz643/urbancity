import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useMemo } from 'react';
import type { Billboard } from '../../types/billboard';
import { TIME_THEMES, type TimeMode } from '../../lib/timeTheme';
import { Bench } from './Bench';
import { StreetLight } from './StreetLight';
import { ThemedSky } from './ThemedSky';
import { Tree } from './Tree';
import { WorldFence } from './WorldFence';
import { RoadLayout } from './RoadLayout';
import { BuildingLayout } from './BuildingLayout';

export type { TimeMode } from '../../lib/timeTheme';
export { TIME_THEMES } from '../../lib/timeTheme';

export function City({timeMode,billboards=[]}:{timeMode:TimeMode;billboards?:Billboard[]}) {
 const theme=TIME_THEMES[timeMode];
 const treePos=useMemo(()=>[
  [-14,0,-45],[-14,0,-5],[-14,0,18],[-14,0,45],[14,0,-45],[14,0,-5],[14,0,18],[14,0,45],[-25,0,-31],[25,0,-31]
 ].filter(([x,,z])=>!billboards.some(b=>Math.hypot(x-b.position[0],z-b.position[2])<7)) as [number,number,number][],[billboards]);
 return <group>
  <color attach="background" args={[theme.bg]}/><fog attach="fog" args={[theme.fog,75,155]}/><ambientLight intensity={theme.ambient}/><directionalLight castShadow position={theme.sunPos} intensity={theme.sun} color={theme.sunColor} shadow-mapSize={[1024,1024]}/>
  <RigidBody type="fixed"><CuboidCollider args={[70,.2,70]} position={[0,-.2,0]}/></RigidBody><ThemedSky timeMode={timeMode}/><mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[120,120]}/><meshStandardMaterial color={theme.ground}/></mesh><WorldFence/>
  <RoadLayout timeMode={timeMode}/>
  <BuildingLayout/>{treePos.map((p,i)=><Tree key={i} position={p}/>)}{Array.from({length:12},(_,i)=><StreetLight key={i} position={[i%2?-12:12,0,-48+Math.floor(i/2)*18]}/>)}<Bench position={[-13,0,26]}/><Bench position={[13,0,-8]}/>
 </group>;
}
