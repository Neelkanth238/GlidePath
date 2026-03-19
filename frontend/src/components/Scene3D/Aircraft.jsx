// Aircraft.jsx — High-Fidelity Professional 3D Model Integration
// Uses a Boeing 787-8 model with corrected orientation and minimalist PBR materials.

import React, { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useFlightStore } from '../../store/useFlightStore';

const B787_URL = 'https://raw.githubusercontent.com/Ysurac/FlightAirMap-3dmodels/master/b788/glTF2/B788.glb';

function AircraftMesh({ isSelected, phase }) {
  const { scene } = useGLTF(B787_URL);
  
  // Clone the scene for individual material state
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        
        // Minimalist/Matte material logic to prevent excessive reflections
        if (node.material) {
          node.material = node.material.clone();
          node.material.metalness = 0.1;
          node.material.roughness = 0.8;
          node.material.envMapIntensity = 0.1; // Minimal reflections
          
          if (isSelected) {
            node.material.emissive = new THREE.Color('#38bdf8');
            node.material.emissiveIntensity = 0.2;
          }
        }
      }
    });
    return clone;
  }, [scene, isSelected]);

  return (
    <primitive 
      object={clonedScene} 
      scale={0.8} 
      // Corrected Orientation: Math.PI works perfectly to align GLTF Z-forward logic
      rotation={[0, Math.PI, 0]} 
      position={[0, -0.15, 0]}
    />
  );
}

export function Aircraft({ flight }) {
  const groupRef = useRef();
  const selectedId = useFlightStore(s => s.selectedFlightId);
  const isSelected = flight.id === selectedId;
  const selectFlight = useFlightStore(s => s.selectFlight);

  const targetPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // ── Silky Smooth Position Interpolation ───────────────────
    targetPos.set(flight.position.x, flight.position.y, flight.position.z);
    // Increased multiplier to tightly track rapid 20Hz server ticks
    groupRef.current.position.lerp(targetPos, Math.min(delta * 12, 1));

    // ── Yaw Interpolation (Velocity-based) ────────────────────
    const dx = targetPos.x - groupRef.current.position.x;
    const dz = targetPos.z - groupRef.current.position.z;
    let diff = 0;
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      // Three.js atan2(x, z) gives the correct Y-rotation to face the movement vector
      const targetYaw = Math.atan2(dx, dz);
      diff = targetYaw - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * Math.min(delta * 4, 1);
    }

    // ── Cinematic Pitch ─────────────────────────────────────
    let targetPitch = 0;
    if (flight.phase === 'APPROACH') targetPitch = -0.05;
    if (flight.phase === 'LANDING')  targetPitch = -0.03;
    if (flight.phase === 'TAKEOFF')  targetPitch = 0.1 + (flight.progress * 0.2);
    
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x, targetPitch, delta * 4
    );

    // ── Subtle Banking on turns ──────────────────────────────
    let targetBank = 0;
    const isTurning = Math.abs(diff) > 0.001;
    if (isTurning && !['TAKEOFF', 'APPROACH'].includes(flight.phase)) {
      targetBank = diff * 4; 
    }
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z, targetBank, delta * 3
    );

    // ── Atmospheric Turbulence ───────────────────────────────
    if (['APPROACH', 'TAKEOFF', 'LANDING'].includes(flight.phase)) {
      const shake = Math.sin(state.clock.elapsedTime * 20) * 0.015;
      groupRef.current.position.y += shake * delta;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[flight.position.x, flight.position.y, flight.position.z]}
      onClick={(e) => { e.stopPropagation(); selectFlight(flight.id); }}
    >
      {isSelected && (
        <mesh position={[0, -flight.position.y + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.5, 5, 64]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={4}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}

      <Suspense fallback={null}>
        <AircraftMesh isSelected={isSelected} phase={flight.phase} />
      </Suspense>
    </group>
  );
}

useGLTF.preload(B787_URL);
