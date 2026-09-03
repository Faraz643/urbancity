(() => {
  'use strict';

  // Player growth is driven by the server so every visitor sees the same size.
  // The scene already contains each avatar as a Group next to its name Text.
  const API = '/api/live/player-growth';
  const BASE_HEIGHT = 2.8;
  const MAX_HEIGHT = 44;
  const SCALE_MIN = 1;

  const growthCache = new Map();
  let scene = null;

  function getScene() {
    if (scene) return scene;
    const canvas = document.querySelector('canvas');
    const root = canvas && canvas.__r3f && canvas.__r3f.root;
    try {
      scene = root && root.getState ? root.getState().scene : null;
    } catch (_) {
      scene = null;
    }
    return scene;
  }

  function findLabelText(object) {
    return typeof object.text === 'string' ? object.text.trim() : '';
  }

  function findAvatarSibling(label) {
    const parent = label && label.parent;
    if (!parent) return null;
    // PlayerAvatar is the group sibling of the name Text. Avoid scaling the name.
    for (const child of parent.children || []) {
      if (child === label) continue;
      if (child && child.isGroup) return child;
    }
    return null;
  }

  function applyGrowth() {
    const rootScene = getScene();
    if (!rootScene) return;

    rootScene.traverse((object) => {
      const label = findLabelText(object);
      if (!label) return;
      const info = growthCache.get(label);
      if (!info) return;
      const avatar = findAvatarSibling(object);
      if (!avatar) return;

      if (!avatar.userData.__urbanGrowthBaseScale) {
        avatar.userData.__urbanGrowthBaseScale = avatar.scale.clone();
      }
      const base = avatar.userData.__urbanGrowthBaseScale;
      const scale = Math.max(SCALE_MIN, Math.min(info.height / BASE_HEIGHT, MAX_HEIGHT / BASE_HEIGHT));
      avatar.scale.set(base.x * scale, base.y * scale, base.z * scale);
    });
  }

  async function pollGrowth() {
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) return;
      const rows = await response.json();
      if (!Array.isArray(rows)) return;
      growthCache.clear();
      for (const row of rows) {
        if (row && typeof row.name === 'string' && Number.isFinite(Number(row.height))) {
          growthCache.set(row.name.trim(), { height: Number(row.height) });
        }
      }
      applyGrowth();
    } catch (_) {
      // Growth is cosmetic; never interfere with the game if the endpoint is unavailable.
    }
  }

  function start() {
    pollGrowth();
    window.setInterval(pollGrowth, 1000);
    window.setInterval(applyGrowth, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
