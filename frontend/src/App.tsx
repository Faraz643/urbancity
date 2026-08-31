import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Environment, Sky, KeyboardControls, PointerLockControls } from '@react-three/drei';
import LoadingScreen from './components/ui/LoadingScreen';
import HUD from './components/ui/HUD';
import BillboardPanel from './components/ui/BillboardPanel';
import CityMap from './components/ui/CityMap';
import MainMenu from './components/ui/MainMenu';
import AuthModal from './components/ui/AuthModal';
import { CityScene } from './components/city/CityScene';
import { Player } from './components/player/Player';
import { MultiplayerPlayers } from './components/multiplayer/MultiplayerPlayers';
import { useGameStore } from './stores/gameStore';

const LazyAdmin = lazy(() => import('./components/ui/AdminDashboard'));

const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
];

function GameScene() {
  const { isMapOpen, isMenuOpen, isBillboardPanelOpen } = useGameStore();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-sky-300">
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows
          camera={{ position: [0, 15, 25], fov: 50, near: 0.1, far: 500 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
        >
          <Sky distance={450000} sunPosition={[100, 50, 100]} inclination={0.5} azimuth={0.25} />
          <Environment preset="city" />
          <ambientLight intensity={0.6} />
          <directionalLight position={[50, 100, 50]} intensity={1.5} castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-100} shadow-camera-right={100}
            shadow-camera-top={100} shadow-camera-bottom={-100} />
          <PointerLockControls />
          <Physics gravity={[0, -9.81, 0]} colliders={false}>
            <CityScene />
            <Player />
            <MultiplayerPlayers />
          </Physics>
        </Canvas>
      </KeyboardControls>
      <HUD />
      {isBillboardPanelOpen && <BillboardPanel />}
      {isMapOpen && <CityMap />}
      {isMenuOpen && <MainMenu />}
      <AuthModal />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<GameScene />} />
        <Route path="/admin" element={<LazyAdmin />} />
      </Routes>
    </Suspense>
  );
}

export default App;
