// Keep wheel input inside the open UrbanCity menu from reaching the 3D camera.
// The menu itself remains scrollable; the backdrop blocks camera zoom.
export function installMenuWheelGuard() {
  const onWheel = (event: WheelEvent) => {
    const target = event.target as HTMLElement | null;
    const menu = target?.closest('.game-menu');
    const overlay = target?.closest('.game-menu-overlay');

    if (menu) {
      // Stop the event before it reaches the Three.js canvas, but do not
      // preventDefault so the menu's own overflow-y:auto can scroll normally.
      event.stopPropagation();
      return;
    }

    if (overlay) {
      // Scrolling the dimmed backdrop should not zoom the game either.
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  return () => window.removeEventListener('wheel', onWheel, true);
}
