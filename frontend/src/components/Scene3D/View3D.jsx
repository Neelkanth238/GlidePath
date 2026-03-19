// View3D.jsx — High-fidelity React-Three-Fiber canvas wrapper
// Composites: cinematic lighting, live aircraft, camera rig, and post-processing stack.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars, Environment, ContactShadows, Float, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, SSAO, Vignette, Noise, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useFlightStore } from '../../store/useFlightStore';
import { AirportScene } from './AirportScene';
import { Aircraft } from './Aircraft';
import { CameraRig } from './CameraRig';

function AtmosphericLighting() {
  return (
    <>
      <ambientLight intensity={0.4} color="#8baad4" />
      {/* Principal minimalist key light */}
      <directionalLight
        position={[80, 200, 100]}
        intensity={0.8}
        color="#d4e8ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Subtle blue fill */}
      <spotLight
        position={[-150, 50, -100]}
        angle={0.6}
        penumbra={1}
        intensity={0.5}
        color="#3b82f6"
      />
      
      {/* Environment map for minor reflections */}
      <Environment preset="city" environmentIntensity={0.1} />
    </>
  );
}

export function View3D() {
  const flights = useFlightStore(s => s.flights);
  const cameraMode = useFlightStore(s => s.cameraMode);

  return (
    <div className="viewport" style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        gl={{ 
          antialias: true, 
          toneMapping: THREE.ACESFilmicToneMapping, 
          toneMappingExposure: 0.8,
          powerPreference: "high-performance"
        }}
        camera={{ fov: 42, near: 1, far: 4000, position: [100, 220, 250] }}
        style={{ background: '#04070d' }}
      >
        {/* ── Atmosphere & Fog ──────────────────────────────── */}
        <color attach="background" args={['#04070d']} />
        <fog attach="fog" args={['#04070d', 300, 1200]} />
        <Stars radius={600} depth={100} count={4000} factor={4} fade speed={0.5} />

        {/* ── Lighting & Reflections ────────────────────────── */}
        <Suspense fallback={null}>
          <AtmosphericLighting />
          
          {/* Static airport environment */}
          <AirportScene />

          {/* Live aircraft — tracked from WebSocket data */}
          {flights.map(flight => (
            <Aircraft key={flight.id} flight={flight} />
          ))}

          {/* Soft contact shadows for grounding objects */}
          <ContactShadows 
            position={[0, -0.01, 0]} 
            opacity={0.65} 
            scale={1000} 
            blur={1.5} 
            far={10} 
            color="#000000"
          />
        </Suspense>

        {/* ── Minimalist Post-Processing ────────────────────────── */}
        <EffectComposer disableNormalPass>
          <Bloom 
            luminanceThreshold={0.9} 
            mipmapBlur 
            intensity={0.4} 
            radius={0.2} 
          />
          <SSAO 
            intensity={5} 
            radius={0.1} 
            luminanceInfluence={0.5} 
            color="#000000"
          />
          <Vignette eskil={false} offset={0.1} darkness={0.8} />
        </EffectComposer>

        {/* Smart dynamic camera rig */}
        {cameraMode === 'FREEFLY' ? (
          <OrbitControls 
            makeDefault 
            maxPolarAngle={Math.PI / 2 - 0.05} // prevent going fully under ground
            minDistance={10} 
            maxDistance={1500} 
          />
        ) : (
          <CameraRig />
        )}
      </Canvas>
    </div>
  );
}
