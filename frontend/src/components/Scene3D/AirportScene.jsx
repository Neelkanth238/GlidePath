// AirportScene.jsx — Enhanced cinematic airport environment
// Renders high-fidelity runways, taxiways, terminal with premium PBR materials.

import React from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

// Realistic Runway with wet-look asphalt and high-intensity lights
function Runway({ position, length = 440, width = 24, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Asphalt base — low roughness for wet/reflective look */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial 
          color="#0a0e16" 
          roughness={0.12} 
          metalness={0.4} 
        />
      </mesh>
      
      {/* Centre-line markings — subtle emissive to pop in post-processing */}
      {Array.from({ length: 22 }).map((_, i) => {
        const z = -length / 2 + i * (length / 22) + 10;
        return (
          <mesh key={i} position={[0, 0.06, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.8, 14]} />
            <meshStandardMaterial 
              color="#e2e8f0" 
              roughness={0.4} 
              emissive="#3b82f6" 
              emissiveIntensity={0.05} 
            />
          </mesh>
        );
      })}

      {/* Threshold markings */}
      {[-length / 2 + 6, length / 2 - 6].map((z, idx) => (
        <mesh key={idx} position={[0, 0.06, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width - 4, 3]} />
          <meshStandardMaterial color="#c8d8f0" roughness={0.3} />
        </mesh>
      ))}

      {/* Edge lights — boosted emissive for Bloom effect */}
      {[-width / 2, width / 2].map((x, side) =>
        Array.from({ length: 40 }).map((_, i) => {
          const z = -length / 2 + i * (length / 40) + length / 80;
          return (
            <mesh key={`${side}-${i}`} position={[x, 0.1, z]}>
              <sphereGeometry args={[0.22, 12, 12]} />
              <meshStandardMaterial
                color="#fde68a"
                emissive="#fbbf24"
                emissiveIntensity={4}
              />
            </mesh>
          );
        })
      )}
    </group>
  );
}

// A sleek dark taxiway
function Taxiway({ from, to, width = 12 }) {
  const [fx, fz] = from;
  const [tx, tz] = to;
  const midX = (fx + tx) / 2;
  const midZ = (fz + tz) / 2;
  const length = Math.hypot(tx - fx, tz - fz);
  const angle = Math.atan2(tx - fx, tz - fz);

  return (
    <mesh position={[midX, 0.03, midZ]} rotation={[-Math.PI / 2, 0, angle]} receiveShadow>
      <planeGeometry args={[width, length]} />
      <meshStandardMaterial color="#0b0f1a" roughness={0.15} metalness={0.3} />
    </mesh>
  );
}

// Parking stand with industrial markings
function Stand({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 24]} />
        <meshStandardMaterial color="#050810" roughness={0.2} metalness={0.5} />
      </mesh>
      {/* Industrial Guidance Line */}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 22]} />
        <meshStandardMaterial color="#fcd34d" roughness={0.5} emissive="#f59e0b" emissiveIntensity={0.2} />
      </mesh>
      {/* Stand lights */}
      <mesh position={[0, 0.08, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4, 32]} />
        <meshStandardMaterial color="#fcd34d" roughness={0.5} transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

// Cinematic Terminal building
function Terminal() {
  return (
    <group position={[230, 0, 10]}>
      {/* Main structure — brushed metal / glass facade */}
      <mesh position={[0, 10, 0]} castShadow receiveShadow>
        <boxGeometry args={[80, 20, 60]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />
      </mesh>
      
      {/* Front glass facade with glowing interior */}
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

      {/* Roof detail */}
      <mesh position={[0, 20.5, 0]}>
        <boxGeometry args={[84, 1.2, 64]} />
        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.6} />
      </mesh>

      {/* Control tower shaft */}
      <mesh position={[25, 35, -25]} castShadow>
        <cylinderGeometry args={[2, 4, 50, 24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
      </mesh>
      
      {/* Tower cab (Glass top) */}
      <mesh position={[25, 62, -25]}>
        <cylinderGeometry args={[5, 4.5, 8, 24]} />
        <meshStandardMaterial
          color="#06b6d4"
          transparent
          opacity={0.7}
          roughness={0.05}
          metalness={1.0}
          emissive="#22d3ee"
          emissiveIntensity={2.0}
        />
      </mesh>
    </group>
  );
}

// Massive ground tarmac level
function Ground() {
  const texture = useTexture('/surat_airport.png');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // Repeat the texture to cover the large 2000x2000 area without being overly stretched
  texture.repeat.set(4, 4);

  return (
    <group>
      {/* The main tarmac with satellite texture map overlaid on the dark color */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial 
          map={texture}
          color="#334155" 
          roughness={0.8} 
          metalness={0.1} 
        />
      </mesh>
      
      {/* Subtle grid of ground point-lights for scale and realism */}
      {Array.from({ length: 15 }).map((_, i) => (
        Array.from({ length: 15 }).map((_, j) => (
          <mesh 
            key={`${i}-${j}`} 
            position={[(i - 7.5) * 150, 0.05, (j - 7.5) * 150]}
          >
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial 
              color="#1e293b" 
              emissive="#1e293b" 
              emissiveIntensity={2} 
            />
          </mesh>
        ))
      ))}
    </group>
  );
}

export const AirportScene = React.memo(function AirportScene() {
  return (
    <group>
      <Ground />

      {/* Primary Runway (Landing, x=0) */}
      <Runway position={[0, 0, 0]} length={520} width={26} />
      
      {/* Secondary Runway (Takeoff, x=70) */}
      <Runway position={[70, 0, 0]} length={520} width={26} />

      {/* Between Landing (0) and Takeoff (70) (Single top connector) */}
      <Taxiway from={[0, -100]} to={[70, -100]} width={12} />

      {/* Between Takeoff (70) and Vertical Taxiway (180) - TOP (Arrivals crossing to terminal) */}
      <Taxiway from={[70, -100]} to={[180, -100]} width={12} />

      {/* Between Takeoff (70) and Vertical Taxiway (180) - BOTTOM (Departures only) */}
      <Taxiway from={[70, 140]} to={[180, 140]} width={12} />

      {/* Main Vertical Taxiway "where plane run after and before terminal" */}
      <Taxiway from={[180, -220]} to={[180, 220]} width={12} />

      {/* Single connector from Vertical Taxiway (180) to Terminal Stands (190+) */}
      <Taxiway from={[180, 0]} to={[210, 0]} width={12} />

      {/* Stands */}
      {['A', 'B', 'C'].map((letter, li) =>
        [1, 2, 3, 4].map((num) => {
          // Adjust stands out to 200 to match terminal relocation
          const sx = 200 + li * 22;
          const sz = -30 + num * 22;
          return (
            <Stand
              key={`${letter}${num}`}
              position={[sx, 0, sz]}
            />
          );
        })
      )}

      {/* Approaches — rows of atmospheric guidance lights */}
      {/* Approach for Landing Runway (x=0, top -> down, so lights at +Z) */}
      {[-1, 1].map(side => (
        Array.from({ length: 12 }).map((_, i) => (
          <mesh key={`landing-app-${side}-${i}`} position={[side * 15, 0.5, 260 + i * 25]}>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial color="white" emissive="#ffffff" emissiveIntensity={5} />
          </mesh>
        ))
      ))}
      
      {/* Approach for Takeoff Runway (if needed, opposite side, x=70, lights at -Z) */}
      {[-1, 1].map(side => (
        Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`takeoff-app-${side}-${i}`} position={[70 + side * 15, 0.5, -260 - i * 25]}>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial color="white" emissive="#ffffff" emissiveIntensity={5} />
          </mesh>
        ))
      ))}

      <Terminal />
    </group>
  );
});
