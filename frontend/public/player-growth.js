(() => {
  'use strict';

  const API = '/api/live/player-growth';
  const BASE_HEIGHT = 2.8;
  const MAX_HEIGHT = 44;
  // PlayerAvatar's local foot point is approximately -1.208 units below the
  // avatar wrapper origin. Moving the wrapper by this amount as it scales keeps
  // the soles on the same world-space floor plane.
  const FOOT_ANCHOR = 1.208;

  let rows = [], scene = null, retry = 1000, timer = 0;
  let api = 'checking', error = '', labels = 0, matched = 0;

  function panel() {
    let e = document.getElementById('urban-growth-debug');
    if (!e) {
      e = document.createElement('div');
      e.id = 'urban-growth-debug';
      Object.assign(e.style, {
        position: 'fixed', top: '12px', left: '12px', zIndex: '99999',
        padding: '10px 12px', background: 'rgba(0,0,0,.82)', color: '#fff',
        font: '12px/1.45 monospace', borderRadius: '8px', pointerEvents: 'none',
        whiteSpace: 'pre', minWidth: '245px'
      });
      document.body.appendChild(e);
    }
    return e;
  }

  function status() {
    const max = rows.reduce((m, r) => Math.max(m, r.height), 0);
    panel().textContent = [
      'URBANCITY GROWTH DEBUG',
      `API: ${api}`,
      `Players from server: ${rows.length}`,
      `Scene: ${scene ? 'YES' : 'NO'}`,
      `Text labels found: ${labels}`,
      `Matched labels: ${matched}`,
      `Max server height: ${max ? max.toFixed(2) + 'm' : '—'}`,
      error ? `Error: ${error}` : 'Error: —'
    ].join('\n');
  }

  // Do not depend on THREE being a global. R3F bundles Three.js as a module,
  // so `THREE.Vector3()` is not available from this standalone public script.
  // Read the world translation directly from Object3D.matrixWorld instead.
  function worldPos(object) {
    const e = object.matrixWorld && object.matrixWorld.elements;
    if (!e) return { x: 0, y: 0, z: 0 };
    return { x: e[12], y: e[13], z: e[14] };
  }

  function nearest(label) {
    const parent = label && label.parent;
    if (!parent || !rows.length || !parent.matrixWorld) return null;
    const p = worldPos(parent);
    let best = null;
    let bestDistance = 12;
    for (const row of rows) {
      const dx = p.x - row.position[0];
      const dy = p.y - row.position[1];
      const dz = p.z - row.position[2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = row;
      }
    }
    return best;
  }

  function avatar(label) {
    let node = label && label.parent;
    while (node) {
      const found = (node.children || []).find(
        child => child && child.userData && child.userData.urbanPlayerAvatar
      );
      if (found) return found;
      node = node.parent;
    }
    return null;
  }

  function apply() {
    scene = window.__urbanCityScene || scene;
    labels = 0;
    matched = 0;

    if (!scene || !rows.length) {
      status();
      return;
    }

    scene.updateMatrixWorld(true);

    scene.traverse(object => {
      if (typeof object.text !== 'string') return;
      labels++;

      const row = nearest(object);
      if (!row) return;

      const visual = avatar(object);
      if (!visual) return;
      matched++;

      if (!visual.userData.__urbanGrowthBaseScale) {
        visual.userData.__urbanGrowthBaseScale = visual.scale.clone();
      }

      const base = visual.userData.__urbanGrowthBaseScale;
      const scale = Math.max(1, Math.min(row.height / BASE_HEIGHT, MAX_HEIGHT / BASE_HEIGHT));

      // Scale around the avatar's origin, then translate that origin upward by
      // exactly the amount required to keep the soles at their original height.
      visual.scale.set(base.x * scale, base.y * scale, base.z * scale);
      visual.position.y = (scale - 1) * FOOT_ANCHOR;

      // Keep the debug label attached above the growing head. It is deliberately
      // not scaled itself, so the diagnostic stays readable at every size.
      object.position.y = 1.15 * scale + 0.70;

      try {
        object.text = `HEIGHT ${row.height.toFixed(2)}m`;
        if (typeof object.sync === 'function') object.sync();
      } catch (_) {}
    });

    status();
  }

  async function poll() {
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('invalid response');

      rows = data
        .filter(row => row && Array.isArray(row.position) && row.position.length === 3 && Number.isFinite(Number(row.height)))
        .map(row => ({
          id: String(row.id || ''),
          name: String(row.name || ''),
          position: [Number(row.position[0]), Number(row.position[1]), Number(row.position[2])],
          height: Math.min(MAX_HEIGHT, Number(row.height))
        }));

      api = 'OK';
      error = '';
      retry = 1000;
      apply();
      schedule(1000);
    } catch (e) {
      api = 'FAIL';
      error = e instanceof Error ? e.message : String(e);
      status();
      schedule(retry);
      retry = Math.min(retry * 2, 10000);
    }
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  }

  function start() {
    panel();
    status();
    poll();
    setInterval(apply, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
