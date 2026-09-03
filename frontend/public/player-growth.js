(() => {
  'use strict';

  // Player growth is driven by the server so every visitor sees the same size.
  // The scene already contains each avatar as a Group next to its name Text.
  const API = '/api/live/player-growth';
  const BASE_HEIGHT = 2.8;
  const MAX_HEIGHT = 44;
  const SCALE_MIN = 1;
  const MATCH_RADIUS = 5;

  let growthRows = [];

  function getScene() {
    return window.__urbanCityScene || null;
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

  function nearestGrowthRow(label) {
    const parent = label && label.parent;
    if (!parent || !growthRows.length || typeof parent.getWorldPosition !== 'function') return null;
    const world = {
      x: 0,
      y: 0,
      z: 0,
      setFromMatrixPosition(matrix) {
        this.x = matrix.elements[12];
        this.y = matrix.elements[13];
        this.z = matrix.elements[14];
        return this;
      },
    };
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
    });
  }

  async function pollGrowth() {
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) return;
      const rows = await response.json();
      if (!Array.isArray(rows)) return;
      growthRows = rows
        .filter((row) => row && Array.isArray(row.position) && row.position.length === 3 && Number.isFinite(Number(row.height)))
        .map((row) => ({
          id: String(row.id || ''),
          name: String(row.name || ''),
          position: [Number(row.position[0]), Number(row.position[1]), Number(row.position[2])],
          height: Number(row.height),
        }));
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
