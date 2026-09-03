(() => {
  'use strict';

  // Diagnostic overlay for player growth. This deliberately uses a DOM panel
  // so we can diagnose the data/scene path without depending on Drei Text APIs.
  const API = '/api/live/player-growth';
  const BASE_HEIGHT = 2.8;
  const MAX_HEIGHT = 44;
  let growthRows = [];
  let scene = null;
  let retryDelay = 1000;
  let pollTimer = 0;
  let apiStatus = 'checking';
  let lastError = '';
  let labelsFound = 0;
  let matched = 0;

  function panel() {
    let el = document.getElementById('urban-growth-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'urban-growth-debug';
      Object.assign(el.style, {
        position: 'fixed', top: '12px', left: '12px', zIndex: '99999',
        padding: '10px 12px', background: 'rgba(0,0,0,.82)', color: '#fff',
        font: '12px/1.45 monospace', borderRadius: '8px',
        pointerEvents: 'none', whiteSpace: 'pre', minWidth: '230px'
      });
      document.body.appendChild(el);
    }
    return el;
  }

  function updatePanel() {
    const max = growthRows.reduce((m, r) => Math.max(m, r.height), 0);
    panel().textContent = [
      'URBANCITY GROWTH DEBUG',
      `API: ${apiStatus}`,
      `Players from server: ${growthRows.length}`,
      `Scene: ${scene ? 'YES' : 'NO'}`,
      `Text labels found: ${labelsFound}`,
      `Matched labels: ${matched}`,
      `Max server height: ${max ? max.toFixed(2) + 'm' : '—'}`,
      lastError ? `Error: ${lastError}` : 'Error: —'
    ].join('\n');
  }

  function getScene() {
    if (window.__urbanCityScene) {
      scene = window.__urbanCityScene;
      return scene;
    }
    return scene;
  }

  function nearestGrowthRow(label) {
    const parent = label && label.parent;
    if (!parent || !growthRows.length || typeof parent.getWorldPosition !== 'function') return null;
    const world = { x: 0, y: 0, z: 0 };
    parent.getWorldPosition(world);
    let best = null;
    let bestDistance = 5;
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

  function findAvatarSibling(label) {
    const parent = label && label.parent;
    if (!parent) return null;
    for (const child of parent.children || []) {
      if (child !== label && child && child.isGroup) return child;
    }
    return null;
  }

  function applyGrowth() {
    const rootScene = getScene();
    labelsFound = 0;
    matched = 0;
    if (!rootScene || !growthRows.length) {
      updatePanel();
      return;
    }

    rootScene.updateMatrixWorld(true);
    rootScene.traverse((object) => {
      if (typeof object.text !== 'string') return;
      labelsFound++;
      const info = nearestGrowthRow(object);
      if (!info) return;
      matched++;

      const avatar = findAvatarSibling(object);
      if (avatar) {
        if (!avatar.userData.__urbanGrowthBaseScale) {
          avatar.userData.__urbanGrowthBaseScale = avatar.scale.clone();
        }
        const base = avatar.userData.__urbanGrowthBaseScale;
        const scale = Math.max(1, Math.min(info.height / BASE_HEIGHT, MAX_HEIGHT / BASE_HEIGHT));
        avatar.scale.set(base.x * scale, base.y * scale, base.z * scale);
      }

      // Diagnostic: keep the live server height on the label if Drei exposes it.
      try {
        object.text = `HEIGHT ${info.height.toFixed(2)}m`;
        if (typeof object.sync === 'function') object.sync();
      } catch (_) {}
    });
    updatePanel();
  }

  async function pollGrowth() {
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('invalid response');
      growthRows = rows
        .filter((row) => row && Array.isArray(row.position) && row.position.length === 3 && Number.isFinite(Number(row.height)))
        .map((row) => ({
          id: String(row.id || ''),
          name: String(row.name || ''),
          position: [Number(row.position[0]), Number(row.position[1]), Number(row.position[2])],
          height: Math.min(MAX_HEIGHT, Number(row.height))
        }));
      apiStatus = 'OK';
      lastError = '';
      scene = window.__urbanCityScene || scene;
      retryDelay = 1000;
      applyGrowth();
      schedulePoll(1000);
    } catch (error) {
      apiStatus = 'FAIL';
      lastError = error instanceof Error ? error.message : String(error);
      updatePanel();
      schedulePoll(retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10000);
    }
  }

  function schedulePoll(delay) {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(pollGrowth, delay);
  }

  function start() {
    panel();
    updatePanel();
    pollGrowth();
    window.setInterval(applyGrowth, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
