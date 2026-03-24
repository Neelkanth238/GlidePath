// Aircraft.jsx — Uber-style smooth interpolation with client-side dead-reckoning
//
// HOW IT WORKS (like Uber's car smoothing):
//   Server sends GPS "snapshots" at 20Hz (every 50ms).
//   Between those ticks, the car/plane would normally snap/stutter.
//   Instead, we store the last known target and smoothly glide toward it
//   every frame at 60fps using exponential decay lerp on position + rotation.
//   Result: buttery 60fps movement even from a 20Hz data source.

import React, { useRef, useMemo, Suspense, memo } from 'react';
import { useFrame }  from '@react-three/fiber';
import { useGLTF }   from '@react-three/drei';
import * as THREE    from 'three';
import { useFlightStore } from '../../store/useFlightStore';

const B787_URL = 'https://raw.githubusercontent.com/Ysurac/FlightAirMap-3dmodels/master/b788/glTF2/B788.glb';

// ─────────────────────────────────────────────────────────────────────────────
// AircraftMesh — loads & clones the GLTF once.
// isSelected is intentionally NOT in the deps so we never re-clone for selection.
// Selection glow is applied via a separate emissive mesh overlay instead.
// ─────────────────────────────────────────────────────────────────────────────
const AircraftMesh = memo(function AircraftMesh({ isSelected }) {
  const { scene } = useGLTF(B787_URL);

  // Clone only once on mount; selection is handled by the parent group's emissive ring
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = false; // planes don't need to receive ground shadows
        if (node.material) {
          node.material = node.material.clone();
          node.material.metalness = 0.15;
          node.material.roughness = 0.75;
          node.material.envMapIntensity = 0.08;
        }
      }
    });
    return clone;
  }, [scene]); // <-- isSelected removed from deps!

  // Apply emissive highlight directly onto the shared mesh (no re-clone)
  useMemo(() => {
    clonedScene.traverse((node) => {
      if (node.isMesh && node.material) {
        if (isSelected) {
          node.material.emissive = new THREE.Color('#38bdf8');
          node.material.emissiveIntensity = 0.25;
        } else {
          node.material.emissive = new THREE.Color(0, 0, 0);
          node.material.emissiveIntensity = 0;
        }
      }
    });
  }, [clonedScene, isSelected]);

  return (
    <primitive
      object={clonedScene}
      scale={0.8}
      rotation={[0, Math.PI, 0]}
      position={[0, -0.15, 0]}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Aircraft — Uber-style smooth movement via client-side interpolation
// ─────────────────────────────────────────────────────────────────────────────
export const Aircraft = memo(function Aircraft({ flight }) {
  const groupRef    = useRef();
  const selectedId  = useFlightStore(s => s.selectedFlightId);
  const selectFlight = useFlightStore(s => s.selectFlight);
  const isSelected  = flight.id === selectedId;

  // ── Dead-reckoning state (survives renders, invisible to React) ─────────────
  // These refs store the live interpolation targets without causing re-renders.
  const smoothPos   = useRef(new THREE.Vector3(flight.position.x, flight.position.y, flight.position.z));
  const smoothYaw   = useRef(0);
  const smoothPitch = useRef(0);
  const smoothBank  = useRef(0);
  const prevYaw     = useRef(0);

  // ── Memoized Vector3 target (updated by server data, no allocation per frame) ──
  const serverTarget = useRef(new THREE.Vector3());

  // ── Pulse ring animation time ────────────────────────────────────────────────
  const pulseTime = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Clamp delta so a slow frame doesn't cause a massive jump
    const dt = Math.min(delta, 0.05);

    // ── 1. Update target from latest server data ──────────────────────────────
    serverTarget.current.set(flight.position.x, flight.position.y, flight.position.z);

    // ── 2. Exponential decay smooth position (Uber's core trick) ─────────────
    //    Speed factor tuned per-phase: taxi should be slower to track than approach
    const posSpeed = flight.phase === 'WAITING' ? 6 : 10;
    const posFactor = 1 - Math.exp(-posSpeed * dt);
    smoothPos.current.lerp(serverTarget.current, posFactor);
    groupRef.current.position.copy(smoothPos.current);

    // ── 3. Yaw — compute from direction of travel, not from server heading ────
    const dx = serverTarget.current.x - groupRef.current.position.x;
    const dz = serverTarget.current.z - groupRef.current.position.z;

    if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
      // +Math.PI compensates for the GLTF model's baked-in 180° flip (rotation={[0,π,0]} on <primitive>)
      const targetYaw = Math.atan2(dx, dz) + Math.PI;
      // Shortest-path interpolation across the ±π boundary
      let yawDiff = targetYaw - smoothYaw.current;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      while (yawDiff >  Math.PI) yawDiff -= Math.PI * 2;

      const yawSpeed = flight.phase === 'TAXI_IN' || flight.phase === 'TAXI_OUT'
        ? 3   // Slower yaw for taxiing (feels heavy)
        : 5;  // Snappier for flying
      smoothYaw.current += yawDiff * (1 - Math.exp(-yawSpeed * dt));
      prevYaw.current = yawDiff;
    }
    groupRef.current.rotation.y = smoothYaw.current;

    // ── 4. Pitch — phase-based cinematic tilt ─────────────────────────────────
    let targetPitch = 0;
    if (flight.phase === 'TAKEOFF')  targetPitch = 0.08 + flight.progress * 0.18;
    if (flight.phase === 'APPROACH') targetPitch = -0.04;
    if (flight.phase === 'LANDING')  targetPitch = -0.02;
    smoothPitch.current += (targetPitch - smoothPitch.current) * (1 - Math.exp(-4 * dt));
    groupRef.current.rotation.x = smoothPitch.current;

    // ── 5. Bank — proportional to how hard we're turning ─────────────────────
    const isTurning = Math.abs(prevYaw.current) > 0.002;
    const targetBank = (isTurning && !['TAKEOFF', 'APPROACH', 'LANDING'].includes(flight.phase))
      ? THREE.MathUtils.clamp(prevYaw.current * 3, -0.5, 0.5)
      : 0;
    smoothBank.current += (targetBank - smoothBank.current) * (1 - Math.exp(-3 * dt));
    groupRef.current.rotation.z = smoothBank.current;

    // ── 6. Atmospheric micro-turbulence (airborne phases only) ───────────────
    if (['APPROACH', 'TAKEOFF', 'LANDING', 'WAITING'].includes(flight.phase)) {
      const t = state.clock.elapsedTime;
      // Two overlapping sine waves = organic, non-repeating turbulence
      const shake = (Math.sin(t * 13.7) * 0.008 + Math.sin(t * 7.3) * 0.005);
      groupRef.current.position.y += shake;
    }

    // ── 7. Selection ring pulse animation ────────────────────────────────────
    if (isSelected) {
      pulseTime.current += dt * 2;
      const ringMesh = groupRef.current.getObjectByName('selectionRing');
      if (ringMesh) {
        const pulse = 0.7 + Math.sin(pulseTime.current) * 0.3;
        ringMesh.material.opacity = pulse * 0.6;
        const s = 1 + Math.sin(pulseTime.current * 0.5) * 0.05;
        ringMesh.scale.setScalar(s);
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[flight.position.x, flight.position.y, flight.position.z]}
      onClick={(e) => { e.stopPropagation(); selectFlight(flight.id); }}
    >
      {/* Selection ground ring — only rendered when selected */}
      {isSelected && (
        <mesh
          name="selectionRing"
          position={[0, -flight.position.y + 0.15, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[4.5, 5.2, 64]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={3}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      )}

      <Suspense fallback={null}>
        <AircraftMesh isSelected={isSelected} />
      </Suspense>
    </group>
  );
});

useGLTF.preload(B787_URL);
