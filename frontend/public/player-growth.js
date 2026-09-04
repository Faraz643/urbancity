(() => {
  'use strict';

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
      Object.assign(el.style, {position:'fixed',top:'12px',left:'12px',zIndex:'99999',padding:'10px 12px',background:'rgba(0,0,0,.82)',color:'#fff',font:'12px/1.45 monospace',borderRadius:'8px',pointerEvents:'none',whiteSpace:'pre',minWidth:'250px'});
      document.body.appendChild(el);
    }
    return el;
  }

  function updatePanel() {
    const max = growthRows.reduce((m,r)=>Math.max(m,r.height),0);
    panel().textContent = [
      'URBANCITY GROWTH DEBUG',
      `API: ${apiStatus}`,
      `Players from server: ${growthRows.length}`,
      `Scene: ${scene ? 'YES' : 'NO'}`,
      `Text labels found: ${labelsFound}`,
      `Matched labels: ${matched}`,
      `Max server height: ${max ? max.toFixed(2)+'m' : '—'}`,
      lastError ? `Error: ${lastError}` : 'Error: —'
    ].join('\n');
  }

  function getScene() {
    if (window.__urbanCityScene) scene = window.__urbanCityScene;
    return scene;
  }

  function worldPosition(object) {
    if (!object || !object.matrixWorld || !object.matrixWorld.elements) return null;
    const e = object.matrixWorld.elements;
    return {x:e[12], y:e[13], z:e[14]};
  }

  function findNearestRow(label) {
    if (!growthRows.length) return null;
    let object = label;
    let best = null;
    let bestDistance = Infinity;
    // Walk up through Text's wrapper hierarchy. One of these ancestors is the
    // actual player/RigidBody group. This avoids getWorldPosition entirely.
    for (let depth=0; object && depth<8; depth++, object=object.parent) {
      const p = worldPosition(object);
      if (!p) continue;
      for (const row of growthRows) {
        const dx=p.x-row.position[0], dy=p.y-row.position[1], dz=p.z-row.position[2];
        const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if (d<bestDistance) { bestDistance=d; best=row; }
      }
    }
    return bestDistance <= 15 ? best : null;
  }

  function findPlayerRoot(label) {
    let object = label;
    let candidate = null;
    for (let depth=0; object && depth<8; depth++, object=object.parent) {
      if (object.children && object.children.some(c => c !== label && c && c.isGroup)) candidate = object;
    }
    return candidate || (label && label.parent) || null;
  }

  function applyGrowth() {
    const rootScene=getScene();
    labelsFound=0; matched=0;
    if (!rootScene || !growthRows.length) { updatePanel(); return; }

    try {
      rootScene.updateMatrixWorld(true);
      rootScene.traverse((object)=>{
        if (typeof object.text !== 'string') return;
        labelsFound++;
        const info=findNearestRow(object);
        if (!info) return;
        matched++;

        const playerRoot=findPlayerRoot(object);
        if (playerRoot && playerRoot.scale && playerRoot.userData) {
          if (!playerRoot.userData.__urbanGrowthBaseScale) playerRoot.userData.__urbanGrowthBaseScale=playerRoot.scale.clone();
          const base=playerRoot.userData.__urbanGrowthBaseScale;
          const scale=Math.max(1,Math.min(info.height/BASE_HEIGHT,MAX_HEIGHT/BASE_HEIGHT));
          playerRoot.scale.set(base.x*scale,base.y*scale,base.z*scale);
        }

        try {
          object.text=`HEIGHT ${info.height.toFixed(2)}m`;
          if (typeof object.sync==='function') object.sync();
        } catch (_) {}
      });
      lastError='';
    } catch (error) {
      lastError=error instanceof Error ? error.message : String(error);
    }
    updatePanel();
  }

  async function pollGrowth() {
    try {
      const response=await fetch(API,{cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows=await response.json();
      if (!Array.isArray(rows)) throw new Error('invalid response');
      growthRows=rows.filter(r=>r&&Array.isArray(r.position)&&r.position.length===3&&Number.isFinite(Number(r.height))).map(r=>({id:String(r.id||''),name:String(r.name||''),position:[Number(r.position[0]),Number(r.position[1]),Number(r.position[2])],height:Math.min(MAX_HEIGHT,Number(r.height))}));
      apiStatus='OK'; lastError=''; scene=window.__urbanCityScene||scene; retryDelay=1000;
      applyGrowth(); schedulePoll(1000);
    } catch(error) {
      apiStatus='FAIL'; lastError=error instanceof Error ? error.message : String(error); updatePanel();
      schedulePoll(retryDelay); retryDelay=Math.min(retryDelay*2,10000);
    }
  }

  function schedulePoll(delay) { window.clearTimeout(pollTimer); pollTimer=window.setTimeout(pollGrowth,delay); }
  function start() { panel(); updatePanel(); pollGrowth(); window.setInterval(applyGrowth,250); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
