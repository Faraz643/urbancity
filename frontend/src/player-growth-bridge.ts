import { getRootState } from '@react-three/fiber';

// R3F v8 exposes getRootState as the supported way to recover a Canvas store
// outside the React render tree. This avoids depending on the canvas.__r3f
// internal shape, which can differ between releases/builds.
const attachSceneBridge = () => {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return false;

  try {
    const state = getRootState(canvas);
    const scene = state?.scene;
    if (!scene) return false;

    (window as any).__urbanCityScene = scene;
    return true;
  } catch {
    return false;
  }
};

const timer = window.setInterval(() => {
  if (attachSceneBridge()) window.clearInterval(timer);
}, 100);

attachSceneBridge();
