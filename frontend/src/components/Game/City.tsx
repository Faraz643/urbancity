import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useMemo } from 'react';
import type { Billboard } from '../../types/billboard';
import { Bench } from './Bench';
import { Building } from './Building';
import { StreetLight } from './StreetLight';
import { ThemedSky } from './ThemedSky';
import { Tree } from './Tree';
import { WorldFence } from './WorldFence';

export type TimeMode = 'morning' | 'evening' | 'night';
export const TIME_THEMES: Record<TimeMode,{bg:string;fog:string;ground:string;road:string;ambient:number;sun:number;sunColor:string;sunPos:[number,number,number]}> = {
 morning:{bg:'#a8cbe0',fog:'#b7d6e6',ground:'#718b79',road:'#303842',ambient:1.05,sun:2.0,sunColor:'#fff0cf',sunPos:[-35,45,25]},
 evening:{bg:'#9b6b72',fog:'#a77a79',ground:'#52605c',road:'#252934',ambient:.72,sun:1.45,sunColor:'#ffb27a',sunPos:[35,22,-25]},
 night:{bg:'#07111e',fog:'#07111e',ground:'#172233',road:'#090f1a',ambient:.5,sun:1.45,sunColor:'#dcecff',sunPos:[25,55,18]}
};

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
  <mesh position={[0,.01,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[18,120]}/><meshStandardMaterial color={theme.road} roughness={.9}/></mesh><mesh position={[0,.012,-29]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[120,14]}/><meshStandardMaterial color="#090f1a" roughness={.9}/></mesh><mesh position={[-10,.025,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,120]}/><meshStandardMaterial color="#46505b"/></mesh><mesh position={[10,.025,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,120]}/><meshStandardMaterial color="#46505b"/></mesh>
  {[-4.5,4.5].map((x,i)=>Array.from({length:12},(_,j)=><mesh key={i+'-'+j} position={[x,.045,-52+j*9]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.18,4.2]}/><meshStandardMaterial color="#d7c95e" emissive="#655c27"/></mesh>))}<mesh position={[0,.05,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.12,120]}/><meshStandardMaterial color="#9d9348"/></mesh><mesh position={[0,.05,-36]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[120,.18]}/><meshStandardMaterial color="#d7c95e"/></mesh>{Array.from({length:7},(_,i)=><mesh key={'cw'+i} position={[-6+i*2,.06,-21.7]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.15,4]}/><meshStandardMaterial color="#d6d9d6"/></mesh>)}
  {buildings.map(([x,z,w,d,h,col],i)=><Building key={i} position={[x,0,z]} size={[w,d]} height={h} color={col}/>)}{treePos.map((p,i)=><Tree key={i} position={p}/>)}{Array.from({length:12},(_,i)=><StreetLight key={i} position={[i%2?-12:12,0,-48+Math.floor(i/2)*18]}/>)}<Bench position={[-13,0,26]}/><Bench position={[13,0,-8]}/>
 </group>;
}
