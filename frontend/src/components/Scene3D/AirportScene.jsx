// AirportScene.jsx — Enhanced cinematic airport environment
// Performance: 225 individual ground light spheres → 1 InstancedMesh
//              Approach lights → InstancedMesh
//              Runway edge lights → InstancedMesh per runway
//              All static — wrapped in React.memo so it never re-renders.

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

// ── Shared geometry & material singletons (created once, reused everywhere) ──
const SPHERE_GEO   = new THREE.SphereGeometry(0.22, 6, 6);
const SPHERE_GEO_S = new THREE.SphereGeometry(0.35, 6, 6);

// ─────────────────────────────────────────────────────────────────────────────
// RunwayLights — InstancedMesh for all edge lights of ONE runway
// ─────────────────────────────────────────────────────────────────────────────
function RunwayEdgeLights({ length, width, count = 40 }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#fde68a', emissive: '#fbbf24', emissiveIntensity: 4,
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const instanceCount = count * 2;

  // Callback ref fires after mount — guaranteed mesh exists
  const meshRef = React.useCallback((mesh) => {
    if (!mesh) return;
    let idx = 0;
    for (const side of [-width / 2, width / 2]) {
      for (let i = 0; i < count; i++) {
        const z = -length / 2 + i * (length / count) + length / (count * 2);
        dummy.position.set(side, 0.1, z);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[SPHERE_GEO, mat, instanceCount]} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ApproachLights — InstancedMesh for approach guidance lights
// ─────────────────────────────────────────────────────────────────────────────
function ApproachLights({ positions }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 'white', emissive: '#ffffff', emissiveIntensity: 5,
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const meshRef = React.useCallback((mesh) => {
    if (!mesh) return;
    positions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[SPHERE_GEO_S, mat, positions.length]} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroundLights — replaces 225 individual sphere meshes with 1 InstancedMesh
// ─────────────────────────────────────────────────────────────────────────────
function GroundLights() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1e293b', emissive: '#1e293b', emissiveIntensity: 1.5,
  }), []);

  const GRID = 15;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const smallSphere = useMemo(() => new THREE.SphereGeometry(0.2, 5, 5), []);

  const meshRef = React.useCallback((mesh) => {
    if (!mesh) return;
    let idx = 0;
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        dummy.position.set((i - 7.5) * 150, 0.05, (j - 7.5) * 150);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[smallSphere, mat, GRID * GRID]} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Runway — single slab + centre markings + threshold + edge lights (instanced)
// ─────────────────────────────────────────────────────────────────────────────
function Runway({ position, length = 440, width = 24, rotation = [0, 0, 0] }) {
  const centerLines = useMemo(() => Array.from({ length: 22 }, (_, i) => (
    -length / 2 + i * (length / 22) + 10
  )), [length]);

  return (
    <group position={position} rotation={rotation}>
      {/* Asphalt */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#0a0e16" roughness={0.12} metalness={0.4} />
      </mesh>

      {/* Centre-line markings — merged into a group but still cheap (no shadow) */}
      {centerLines.map((z, i) => (
        <mesh key={i} position={[0, 0.06, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 14]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.4} emissive="#3b82f6" emissiveIntensity={0.05} />
        </mesh>
      ))}

      {/* Threshold markings */}
      {[-length / 2 + 6, length / 2 - 6].map((z, idx) => (
        <mesh key={idx} position={[0, 0.06, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width - 4, 3]} />
          <meshStandardMaterial color="#c8d8f0" roughness={0.3} />
        </mesh>
      ))}

      {/* Edge lights — all in ONE instanced draw call */}
      <RunwayEdgeLights length={length} width={width} />
    </group>
  );
}

// Simple taxiway slab
function Taxiway({ from, to, width = 12 }) {
  const [fx, fz] = from;
  const [tx, tz] = to;
  const midX = (fx + tx) / 2;
  const midZ = (fz + tz) / 2;
  const length = Math.hypot(tx - fx, tz - fz);
  const angle  = Math.atan2(tx - fx, tz - fz);
  return (
    <mesh position={[midX, 0.03, midZ]} rotation={[-Math.PI / 2, 0, angle]} receiveShadow>
      <planeGeometry args={[width, length]} />
      <meshStandardMaterial color="#0b0f1a" roughness={0.15} metalness={0.3} />
    </mesh>
  );
}

// Parking stand
function Stand({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 24]} />
        <meshStandardMaterial color="#050810" roughness={0.2} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 22]} />
        <meshStandardMaterial color="#fcd34d" roughness={0.5} emissive="#f59e0b" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 0.08, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4, 24]} />
        <meshStandardMaterial color="#fcd34d" roughness={0.5} transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

// Terminal building
function Terminal() {
  return (
    <group position={[230, 0, 10]}>
      <mesh position={[0, 10, 0]} castShadow receiveShadow>
        <boxGeometry args={[80, 20, 60]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[-40.1, 8, 0]}>
        <boxGeometry args={[0.2, 14, 54]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.05}
          metalness={0.9}
          transparent
          opacity={0.4}
          emissive="#38bdf8"
          emissiveIntensity={1.2}
        />
      </mesh>
      <mesh position={[0, 20.5, 0]}>
        <boxGeometry args={[84, 1.2, 64]} />
        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.6} />
      </mesh>
      {/* Control tower */}
      <mesh position={[25, 35, -25]} castShadow>
        <cylinderGeometry args={[2, 4, 50, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[25, 62, -25]}>
        <cylinderGeometry args={[5, 4.5, 8, 16]} />
        <meshStandardMaterial
          color="#06b6d4"
          transparent opacity={0.7}
          roughness={0.05} metalness={1.0}
          emissive="#22d3ee" emissiveIntensity={2.0}
        />
      </mesh>
    </group>
  );
}

// Ground tarmac with satellite texture
function Ground() {
  const texture = useTexture('/surat_airport.png');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial map={texture} color="#334155" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* 225 spheres → 1 instanced draw call */}
      <GroundLights />
    </group>
  );
}

// Pre-compute approach light positions to avoid creating arrays in render
const LANDING_APPROACH_POS = [-1, 1].flatMap(side =>
  Array.from({ length: 12 }, (_, i) => [side * 15, 0.5, 260 + i * 25])
);
const TAKEOFF_APPROACH_POS = [-1, 1].flatMap(side =>
  Array.from({ length: 8 }, (_, i) => [70 + side * 15, 0.5, -260 - i * 25])
);

const STAND_POSITIONS = ['A', 'B', 'C'].flatMap((_, li) =>
  [1, 2, 3, 4].map(num => [200 + li * 22, 0, -30 + num * 22])
);

export const AirportScene = React.memo(function AirportScene() {
  return (
    <group>
      <Ground />

      <Runway position={[0,  0, 0]} length={520} width={26} />
      <Runway position={[70, 0, 0]} length={520} width={26} />

      <Taxiway from={[0,   -100]} to={[70,  -100]} />
      <Taxiway from={[70,  -100]} to={[180, -100]} />
      <Taxiway from={[70,   140]} to={[180,  140]} />
      <Taxiway from={[180, -220]} to={[180,  220]} />
      <Taxiway from={[180,    0]} to={[210,    0]} />

      {STAND_POSITIONS.map(([x, y, z], i) => (
        <Stand key={i} position={[x, y, z]} />
      ))}

      {/* Approach lights — 2 instanced draw calls instead of 40 individual meshes */}
      <ApproachLights positions={LANDING_APPROACH_POS} />
      <ApproachLights positions={TAKEOFF_APPROACH_POS} />

      <Terminal />
    </group>
  );
});
