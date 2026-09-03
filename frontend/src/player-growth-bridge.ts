const attachSceneBridge = () => {
  const canvas = document.querySelector('canvas') as (HTMLCanvasElement & { __r3f?: { root?: { getState?: () => { scene?: unknown } } } }) | null;
  if (!canvas) return false;

  try {
    const state = canvas.__r3f?.root?.getState?.();
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
