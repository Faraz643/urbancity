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
  const [, getKeys] = useKeyboardControls();
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);
  const [isSpawned, setIsSpawned] = useState(false);
  const [movementState, setMovementState] = useState<'idle' | 'walking'>('idle');
  const lastEmit = useRef(0);
  const spawnPos = { x: 0, y: 2, z: 10 };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSpawned(true);
      emitPlayerSpawn(spawnPos, 'Visitor');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || !isSpawned) return;

    const { forward, backward, left, right } = getKeys();
    const isMoving = forward || backward || left || right;
    if (isMoving && movementState !== 'walking') setMovementState('walking');
    else if (!isMoving && movementState !== 'idle') setMovementState('idle');

    const velocity = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();
    const moveDir = new THREE.Vector3();

    // Move relative to the direction the camera is facing.
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();

    const cameraRight = new THREE.Vector3().crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();

    if (forward) moveDir.add(cameraForward);
    if (backward) moveDir.sub(cameraForward);
    if (right) moveDir.add(cameraRight);
    if (left) moveDir.sub(cameraRight);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      if (meshRef.current) {
        meshRef.current.rotation.y = THREE.MathUtils.lerp(
          meshRef.current.rotation.y,
          targetRotation,
          Math.min(1, ROTATION_SPEED * delta)
        );
      }
    }

    rigidBodyRef.current.setLinvel({
      x: moveDir.x * SPEED,
      y: velocity.y,
      z: moveDir.z * SPEED,
    });

    // Follow the player without overwriting mouse-controlled camera rotation.
    const followOffset = new THREE.Vector3(0, 12, 18);
    followOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);
    const targetCamPos = new THREE.Vector3(pos.x, pos.y, pos.z).add(followOffset);
    camera.position.lerp(targetCamPos, Math.min(1, 5 * delta));

    setPlayerPosition({ x: pos.x, y: pos.y, z: pos.z });

    const now = Date.now();
    if (now - lastEmit.current > 50) {
      lastEmit.current = now;
      const rot = meshRef.current?.rotation || new THREE.Euler();
      emitPlayerMove(
        { x: pos.x, y: pos.y, z: pos.z },
        { x: rot.x, y: rot.y, z: rot.z },
        movementState
      );
    }
  });

  if (!isSpawned) return null;

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={[spawnPos.x, spawnPos.y, spawnPos.z]}
      type="dynamic"
      enabledRotations={[false, false, false]}
      colliders={false}
      lockRotations
    >
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
