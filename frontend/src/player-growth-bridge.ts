import { getRootState } from '@react-three/fiber';

const attachSceneBridge = () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return false;
  try {
    const state = getRootState(canvas);
    (window as any).__urbanCityScene = state.scene;
    return true;
  } catch {
    return false;
  }
};

const timer = window.setInterval(() => {
  if (attachSceneBridge()) window.clearInterval(timer);
}, 100);

attachSceneBridge();
