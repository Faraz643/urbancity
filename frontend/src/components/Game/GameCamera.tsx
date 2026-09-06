import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function GameCamera() {
  const yaw = useRef(0);
  // Start much closer to a straight third-person view instead of looking down from above.
  const pitch = useRef(0.12);
  // Start roughly one scroll-in closer than before.
  const distance = useRef(8);

  // Smooth the Rapier player's physics position before the camera uses it.
  // This removes tiny physics-step corrections that can look like screen shake.
  const smoothTarget = useRef(new THREE.Vector3(0, 3.6, 8));
  const smoothCamera = useRef(new THREE.Vector3(0, 6.5, 18));
  const dragging = useRef(false);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if ((window as any).__urbanModalOpen) return;
      if (e.button === 0) {
        dragging.current = true;
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };

    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      yaw.current -= e.movementX * 0.0045;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + e.movementY * 0.0048,
        -0.18,
        1.32,
      );
    };

    const up = (e: MouseEvent) => {
      if (e.button === 0) {
        dragging.current = false;
        document.body.style.cursor = 'default';
      }
    };

    const menu = (e: MouseEvent) => e.preventDefault();

    const wheel = (e: WheelEvent) => {
      if ((window as any).__urbanModalOpen) return;
      e.preventDefault();
      distance.current = THREE.MathUtils.clamp(
        distance.current + e.deltaY * 0.035,
        4.5,
        18,
      );
    };

    window.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('contextmenu', menu);
    window.addEventListener('wheel', wheel, { passive: false });

    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('contextmenu', menu);
      window.removeEventListener('wheel', wheel);
    };
  }, []);

  useFrame(({ camera }, dt) => {
    const p = (window as any).__urbanPlayerPosition as THREE.Vector3 | undefined;
    if (!p) return;

    // Ignore tiny vertical Rapier corrections on this flat city map and smooth X/Z.
    const rawTarget = new THREE.Vector3(p.x, 3.1, p.z);
    const targetAlpha = 1 - Math.exp(-14 * dt);
    smoothTarget.current.lerp(rawTarget, targetAlpha);
    const target = smoothTarget.current;

    const horizontal = Math.max(2.2, Math.cos(pitch.current) * distance.current);
    (window as any).__urbanCameraYaw = yaw.current;

    const desired = new THREE.Vector3(
      target.x + Math.sin(yaw.current) * horizontal,
      target.y + Math.sin(pitch.current) * distance.current,
      target.z + Math.cos(yaw.current) * horizontal,
    );

    const cameraAlpha = 1 - Math.exp(-10 * dt);
    smoothCamera.current.lerp(desired, cameraAlpha);
    camera.position.copy(smoothCamera.current);
    camera.lookAt(target);
  });

  return null;
}
