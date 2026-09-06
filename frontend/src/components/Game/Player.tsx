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
};

export function Player({
  billboards,
  onNearby,
  onMove,
  onPosition,
  onFootfallEnter,
  onFootfallLeave,
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

      if ([
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'ShiftLeft', 'ShiftRight',
      ].includes(e.code)) {
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

    const up = (e: KeyboardEvent) => {
      pressed.current[e.code] = false;
    };

    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onNearby]);

  useFrame((_, dt) => {
    if (!body.current) return;

    const keys = pressed.current;
    const inputX = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
    const inputZ = ((keys.KeyS || keys.ArrowDown) ? 1 : 0) - ((keys.KeyW || keys.ArrowUp) ? 1 : 0);
    const direction = new THREE.Vector3(inputX, 0, inputZ);
    const yaw = (window as any).__urbanCameraYaw ?? 0;

    if (direction.lengthSq() > 0) {
      direction.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    }

    const speed = keys.ShiftLeft || keys.ShiftRight ? 11 : 7;
    velocity.current.lerp(direction.multiplyScalar(speed), Math.min(1, dt * 12));

    const currentVelocity = body.current.linvel();
    body.current.setLinvel({ x: velocity.current.x, y: currentVelocity.y, z: velocity.current.z }, true);

    const position = body.current.translation();
    const moving = velocity.current.lengthSq() > 0.1;

    if (moving) {
      const angle = Math.atan2(velocity.current.x, velocity.current.z);
      body.current.setRotation({
        x: 0,
        y: Math.sin(angle / 2),
        z: 0,
        w: Math.cos(angle / 2),
      }, true);
    }

    target.current.set(position.x, position.y, position.z);
    (window as any).__urbanPlayerPosition = target.current.clone();
    onPosition([position.x, position.y, position.z]);

    let nearest: Billboard | null = null;
    let nearestDistance = Infinity;
    for (const billboard of billboards) {
      const distance = Math.hypot(position.x - billboard.position[0], position.z - billboard.position[2]);
      if (distance < 5 && distance < nearestDistance) {
        nearest = billboard;
        nearestDistance = distance;
      }
    }

    onNearby(nearest);
    (window as any).__urbanNearbyBillboard = nearest;

    const nextInside = new Set<string>();
    for (const billboard of billboards) {
      const distance = Math.hypot(position.x - billboard.position[0], position.z - billboard.position[2]);
      if (distance <= billboardTrafficRadius(billboard)) nextInside.add(billboard.id);
    }

    const previousInside = footfallInsideIds.current;
    for (const id of nextInside) {
      if (!previousInside.has(id)) onFootfallEnter(id);
    }
    for (const id of previousInside) {
      if (!nextInside.has(id)) onFootfallLeave(id);
    }
    footfallInsideIds.current = nextInside;

    networkAt.current += dt;
    if (networkAt.current > 0.08) {
      networkAt.current = 0;
      onMove({
        position: [position.x, position.y, position.z],
        rotation: Math.atan2(velocity.current.x, velocity.current.z),
        moving,
      });
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[0, 1.4, 8]}
      enabledRotations={[false, false, false]}
      angularDamping={12}
      linearDamping={8}
      friction={0}
      mass={1}
    >
      <CapsuleCollider args={[0.75, 0.42]} />
      <PlayerAvatar moving={velocity.current.lengthSq() > 0.1} />
    </RigidBody>
  );
}
