(() => {
  'use strict';

  const API = '/api/live/player-growth';
  const BASE_HEIGHT = 2.8;
  const MAX_HEIGHT = 44;
  const SCALE_MIN = 1;
  const MATCH_RADIUS = 5;

  let growthRows = [];
  let scene = null;
  let retryDelay = 1000;
  let pollTimer = 0;

  function getScene() {
    const bridged = window.__urbanCityScene;
    if (bridged) {
      scene = bridged;
      return scene;
    }

    // Fallback for builds where the bridge has not mounted yet.
    const canvas = document.querySelector('canvas');
    const r3f = canvas && canvas.__r3f;
    const root = r3f && r3f.root;
    try {
      if (root && typeof root.getState === 'function') scene = root.getState().scene || null;
      else if (root && root.current && typeof root.current.getState === 'function') scene = root.current.getState().scene || null;
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
    for (const child of parent.children || []) {
      if (child === label) continue;
      if (child && child.isGroup) return child;
    }
    return null;
  }

  function nearestGrowthRow(label) {
    const parent = label && label.parent;
    if (!parent || !growthRows.length || typeof parent.getWorldPosition !== 'function') return null;

    const world = new THREE.Vector3();
    parent.getWorldPosition(world);

    let best = null;
    let bestDistance = MATCH_RADIUS;
    for (const row of growthRows) {
      const dx = world.x - row.position[0];
      const dy = world.y - row.position[1];
      const dz = world.z - row.position[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = row;
      }
    }
    return best;
  }

  function applyGrowth() {
    const rootScene = getScene();
    if (!rootScene || !growthRows.length) return;

    rootScene.updateMatrixWorld(true);
    rootScene.traverse((object) => {
      const label = findLabelText(object);
      if (!label) return;

      const info = nearestGrowthRow(object);
      if (!info) return;

      const avatar = findAvatarSibling(object);
      if (!avatar) return;

      if (!avatar.userData.__urbanGrowthBaseScale) {
        avatar.userData.__urbanGrowthBaseScale = avatar.scale.clone();
      }

      const base = avatar.userData.__urbanGrowthBaseScale;
      const scale = Math.max(SCALE_MIN, Math.min(info.height / BASE_HEIGHT, MAX_HEIGHT / BASE_HEIGHT));
      avatar.scale.set(base.x * scale, base.y * scale, base.z * scale);
      avatar.userData.__urbanGrowthHeight = info.height;
    });
  }

  async function pollGrowth() {
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error(`growth endpoint ${response.status}`);

      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('invalid growth response');

      growthRows = rows
        .filter((row) => row && Array.isArray(row.position) && row.position.length === 3 && Number.isFinite(Number(row.height)))
        .map((row) => ({
          id: String(row.id || ''),
          name: String(row.name || ''),
          position: [Number(row.position[0]), Number(row.position[1]), Number(row.position[2])],
          height: Number(row.height),
        }));

      scene = window.__urbanCityScene || null;
      retryDelay = 1000;
      applyGrowth();
      schedulePoll(1000);
    } catch (_) {
      // Backend can start after Vite. Retry quietly with backoff instead of
      // hammering the proxy while the server is still listening on port 3001.
      schedulePoll(retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10000);
    }
  }

  function schedulePoll(delay) {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(pollGrowth, delay);
  }

  function start() {
    pollGrowth();
    window.setInterval(applyGrowth, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();