import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';
import { emitPlayerMove, emitPlayerSpawn } from '@/utils/socket';

const SPEED = 8;
const ROTATION_SPEED = 5;

export function Player() {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [sub] = useKeyboardControls();
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);
  const [isSpawned, setIsSpawned] = useState(false);
  const [movementState, setMovementState] = useState<'idle' | 'walking'>('idle');
  const lastEmit = useRef(0);
  const spawnPos = { x: 0, y: 2, z: 10 };

  useEffect(() => {
    if (!isSpawned) {
      setTimeout(() => { setIsSpawned(true); emitPlayerSpawn(spawnPos, 'Visitor'); }, 1000);
    }
  }, [isSpawned]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || !isSpawned) return;
    const { forward, backward, left, right } = sub();
    const isMoving = forward || backward || left || right;
    if (isMoving && movementState !== 'walking') setMovementState('walking');
    else if (!isMoving && movementState !== 'idle') setMovementState('idle');

    const velocity = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();
    const moveDir = new THREE.Vector3(0, 0, 0);
    if (forward) moveDir.z -= 1;
    if (backward) moveDir.z += 1;
    if (left) moveDir.x -= 1;
    if (right) moveDir.x += 1;

    if (moveDir.length() > 0) {
      moveDir.normalize();
      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      if (meshRef.current) {
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation, ROTATION_SPEED * delta);
      }
    }

    rigidBodyRef.current.setLinvel({ x: moveDir.x * SPEED, y: velocity.y, z: moveDir.z * SPEED });

    const targetCamPos = new THREE.Vector3(pos.x, pos.y + 12, pos.z + 18);
    camera.position.lerp(targetCamPos, 5 * delta);
    camera.lookAt(pos.x, pos.y + 2, pos.z);

    setPlayerPosition({ x: pos.x, y: pos.y, z: pos.z });

    const now = Date.now();
    if (now - lastEmit.current > 50) {
      lastEmit.current = now;
      const rot = meshRef.current?.rotation || new THREE.Euler();
      emitPlayerMove({ x: pos.x, y: pos.y, z: pos.z }, { x: rot.x, y: rot.y, z: rot.z }, movementState);
    }
  });

  if (!isSpawned) return null;

  return (
    <RigidBody ref={rigidBodyRef} position={[spawnPos.x, spawnPos.y, spawnPos.z]} type="dynamic"
      enabledRotations={[false, false, false]} colliders={false} lockRotations>
      <CapsuleCollider args={[0.8, 0.5]} />
      <group ref={meshRef}>
        <mesh castShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.5, 1.2, 4, 8]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 1.1, 0]}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshStandardMaterial color="#fca5a5" roughness={0.5} />
        </mesh>
      </group>
    </RigidBody>
  );
}
