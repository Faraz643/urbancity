import { TIME_THEMES, type TimeMode } from '../../lib/timeTheme';

export function RoadLayout({ timeMode }: { timeMode: TimeMode }) {
  const theme = TIME_THEMES[timeMode];
  return <>
    <mesh position={[0,.01,0]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[18,120]}/><meshStandardMaterial color={theme.road} roughness={.9}/>
    </mesh>
    <mesh position={[0,.012,-29]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[120,14]}/><meshStandardMaterial color="#090f1a" roughness={.9}/>
    </mesh>
    <mesh position={[-10,.025,0]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[2,120]}/><meshStandardMaterial color="#46505b"/>
    </mesh>
    <mesh position={[10,.025,0]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[2,120]}/><meshStandardMaterial color="#46505b"/>
    </mesh>
    {[-4.5,4.5].map((x,i)=>Array.from({length:12},(_,j)=><mesh key={i+'-'+j} position={[x,.045,-52+j*9]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[.18,4.2]}/><meshStandardMaterial color="#d7c95e" emissive="#655c27"/>
    </mesh>))}
    <mesh position={[0,.05,0]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[.12,120]}/><meshStandardMaterial color="#9d9348"/>
    </mesh>
    <mesh position={[0,.05,-36]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[120,.18]}/><meshStandardMaterial color="#d7c95e"/>
    </mesh>
    {Array.from({length:7},(_,i)=><mesh key={'cw'+i} position={[-6+i*2,.06,-21.7]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[1.15,4]}/><meshStandardMaterial color="#d6d9d6"/>
    </mesh>)}
  </>;
}
