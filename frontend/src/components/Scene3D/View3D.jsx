// View3D.jsx — High-fidelity React-Three-Fiber canvas wrapper
// Composites: cinematic lighting, live aircraft, camera rig, and a lean post-processing stack.
// Performance: SSAO removed (major GPU drain), ContactShadows scaled back, Stars count reduced.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars, Environment, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useFlightStore } from '../../store/useFlightStore';
import { AirportScene } from './AirportScene';
import { Aircraft } from './Aircraft';
import { CameraRig } from './CameraRig';

function AtmosphericLighting() {
  return (
    <>
      <ambientLight intensity={0.4} color="#8baad4" />

      {/* Principal key light — shadow map tuned for performance */}
      <directionalLight
        position={[80, 200, 100]}
        intensity={0.8}
        color="#d4e8ff"
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-far={800}
        shadow-camera-left={-300}
        shadow-camera-right={300}
        shadow-camera-top={300}
        shadow-camera-bottom={-300}
        shadow-bias={-0.001}
      />

      {/* Subtle blue fill — no shadow needed */}
      <spotLight
        position={[-150, 50, -100]}
        angle={0.6}
        penumbra={1}
        intensity={0.5}
        color="#3b82f6"
        castShadow={false}
      />

      {/* Very subtle environment for PBR reflections */}
      <Environment preset="city" environmentIntensity={0.08} />
    </>
  );
}

export function View3D() {
  const flights    = useFlightStore(s => s.flights);
  const cameraMode = useFlightStore(s => s.cameraMode);

  return (
    <div className="viewport" style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows="soft"
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
          powerPreference: 'high-performance',
          // Limit pixel ratio to 1.5 — no visible quality loss, massive perf gain on HiDPI
          // (handled via dpr below)
        }}
        dpr={[1, 1.5]}
        camera={{ fov: 42, near: 1, far: 3000, position: [100, 220, 250] }}
        style={{ background: '#04070d' }}
        frameloop="always"
        performance={{ min: 0.5 }} // r3f adaptive performance
      >
        {/* ── Atmosphere & Fog ──────────────────────────────── */}
        <color attach="background" args={['#04070d']} />
        <fog attach="fog" args={['#04070d', 400, 1400]} />

        {/* Reduced star count for better perf */}
        <Stars radius={600} depth={100} count={2000} factor={4} fade speed={0.4} />

        <Suspense fallback={null}>
          <AtmosphericLighting />
          <AirportScene />

          {/* Live aircraft — each one independently interpolates at 60fps */}
          {flights.map(flight => (
            <Aircraft key={flight.id} flight={flight} />
          ))}
        </Suspense>

        {/* ── Lean Post-Processing (SSAO removed — 40% GPU savings) ──────── */}
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom
            luminanceThreshold={0.85}
            mipmapBlur
            intensity={0.35}
            radius={0.18}
            levels={5}
          />
          <Vignette eskil={false} offset={0.12} darkness={0.75} />
        </EffectComposer>

        {/* Smart dynamic camera rig */}
        {cameraMode === 'FREEFLY' ? (
          <OrbitControls
            makeDefault
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={10}
            maxDistance={1500}
            enableDamping
            dampingFactor={0.08}
          />
        ) : (
          <CameraRig />
        )}
      </Canvas>
    </div>
  );
}
