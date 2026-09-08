import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Billboard } from '../../types/billboard';
import { billboardTrafficRadius } from '../../lib/billboard';
import { PlayerAvatar } from './PlayerAvatar';

type PlayerMoveState = {
  position: [number, number, number];
  rotation: number;
  moving: boolean;
};

type PlayerProps = {
  billboards: Billboard[];
  onNearby: (billboard: Billboard | null) => void;
  onMove: (state: PlayerMoveState) => void;
  onPosition: (position: [number, number, number]) => void;
  onFootfallEnter: (id: string) => void;
  onFootfallLeave: (id: string) => void;
  disabled?: boolean;
  spawnPosition?: [number, number, number];
  armed?: boolean;
};

export function Player({
  billboards,
  onNearby,
  onMove,
  onPosition,
  onFootfallEnter,
  onFootfallLeave,
  disabled = false,
  spawnPosition = [0, 1.4, 8],
  armed = false,
}: PlayerProps) {
  const body = useRef<RapierRigidBody>(null!);
  const pressed = useRef<Record<string, boolean>>({});
  const velocity = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const networkAt = useRef(0);
  const footfallInsideIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((window as any).__urbanModalOpen) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        pressed.current[e.code] = true;
        e.preventDefault();
      }
      if (e.code === 'KeyE') {
        const billboard = (window as any).__urbanNearbyBillboard as Billboard | null;
        if (billboard) {
          e.preventDefault();
          onNearby(billboard);
          (window as any).__urbanInteractBillboard?.(billboard);
        }
      }
    };
    const up = (e: KeyboardEvent) => { pressed.current[e.code] = false; };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onNearby]);

  useEffect(() => {
    if (!body.current) return;
    body.current.setTranslation({ x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] }, true);
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    velocity.current.set(0, 0, 0);
  }, [spawnPosition[0], spawnPosition[1], spawnPosition[2]]);

  useFrame((_, dt) => {
    if (!body.current) return;
    const position = body.current.translation();

    if (disabled) {
      velocity.current.set(0, 0, 0);
      const currentVelocity = body.current.linvel();
      body.current.setLinvel({ x: 0, y: currentVelocity.y, z: 0 }, true);
      (window as any).__urbanPlayerPosition = new THREE.Vector3(position.x, position.y, position.z);
      return;
    }

    const keys = pressed.current;
    const inputX = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
    const inputZ = ((keys.KeyS || keys.ArrowDown) ? 1 : 0) - ((keys.KeyW || keys.ArrowUp) ? 1 : 0);
    const direction = new THREE.Vector3(inputX, 0, inputZ);
    const yaw = (window as any).__urbanCameraYaw ?? 0;
    if (direction.lengthSq() > 0) direction.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const speed = keys.ShiftLeft || keys.ShiftRight ? 11 : 7;
    velocity.current.lerp(direction.multiplyScalar(speed), Math.min(1, dt * 12));
    const currentVelocity = body.current.linvel();
    body.current.setLinvel({ x: velocity.current.x, y: currentVelocity.y, z: velocity.current.z }, true);
    const moving = velocity.current.lengthSq() > 0.1;

    if (moving) {
      const angle = Math.atan2(velocity.current.x, velocity.current.z);
      body.current.setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }, true);
    }

    target.current.set(position.x, position.y, position.z);
    (window as any).__urbanPlayerPosition = target.current.clone();
    onPosition([position.x, position.y, position.z]);

    let nearest: Billboard | null = null;
    let nearestDistance = Infinity;
    for (const billboard of billboards) {
      const distance = Math.hypot(position.x - billboard.position[0], position.z - billboard.position[2]);
      if (distance < 5 && distance < nearestDistance) { nearest = billboard; nearestDistance = distance; }
    }
    onNearby(nearest);
    (window as any).__urbanNearbyBillboard = nearest;

    const nextInside = new Set<string>();
    for (const billboard of billboards) {
      const distance = Math.hypot(position.x - billboard.position[0], position.z - billboard.position[2]);
      if (distance <= billboardTrafficRadius(billboard)) nextInside.add(billboard.id);
    }
    const previousInside = footfallInsideIds.current;
    for (const id of nextInside) if (!previousInside.has(id)) onFootfallEnter(id);
    for (const id of previousInside) if (!nextInside.has(id)) onFootfallLeave(id);
    footfallInsideIds.current = nextInside;

    networkAt.current += dt;
    if (networkAt.current > 0.08) {
      networkAt.current = 0;
      onMove({ position: [position.x, position.y, position.z], rotation: Math.atan2(velocity.current.x, velocity.current.z), moving });
    }
  });

  return (
    <RigidBody ref={body} colliders={false} position={spawnPosition} enabledRotations={[false, false, false]} angularDamping={12} linearDamping={8} friction={0} mass={1}>
      <CapsuleCollider args={[0.75, 0.42]} />
      <PlayerAvatar moving={velocity.current.lengthSq() > 0.1} />
      {armed && <group position={[0.48, 1.15, 0.38]} rotation={[0, 0, -0.1]}>
        <mesh castShadow><boxGeometry args={[0.12, 0.14, 0.58]} /><meshStandardMaterial color="#1b2029" metalness={0.5} roughness={0.35} /></mesh>
        <mesh position={[0, 0.01, 0.35]}><cylinderGeometry args={[0.035, 0.035, 0.35, 8]} rotation={[Math.PI / 2, 0, 0]} /><meshStandardMaterial color="#080b10" metalness={0.7} /></mesh>
        <mesh position={[0, -0.12, -0.08]} rotation={[0.25, 0, 0]}><boxGeometry args={[0.11, 0.25, 0.12]} /><meshStandardMaterial color="#11151c" /></mesh>
      </group>}
    </RigidBody>
  );
}
