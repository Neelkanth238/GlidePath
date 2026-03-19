// CameraRig.jsx — Dynamic camera controller for Three.js scene
// Three modes: TOWER (isometric overview), FOLLOW (tracks selected aircraft),
// RUNWAY (side-on view of active landing/takeoff)

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFlightStore } from '../../store/useFlightStore';

// Fixed camera positions/orientations per mode
const TOWER_POS    = new THREE.Vector3(60, 180, 200);
const TOWER_LOOK   = new THREE.Vector3(20, 0, -30);
const RUNWAY_POS   = new THREE.Vector3(-120, 15, 50);

// How fast the camera lerps to its target (higher = snappier)
const LERP_SPEED = 2.5;

export function CameraRig() {
  const { camera } = useThree();
  const cameraMode = useFlightStore(s => s.cameraMode);
  const flights    = useFlightStore(s => s.flights);
  const selectedId = useFlightStore(s => s.selectedFlightId);

  const lookTarget = useRef(new THREE.Vector3(20, 0, -30));
  const posTarget  = useRef(new THREE.Vector3(60, 180, 200));

  useFrame((_, delta) => {
    const selected = flights.find(f => f.id === selectedId);
    const lerpT    = Math.min(delta * LERP_SPEED, 1);

    if (cameraMode === 'TOWER') {
      // ── Fixed high isometric overview ─────────────────────────────────
      posTarget.current.copy(TOWER_POS);
      lookTarget.current.copy(TOWER_LOOK);

    } else if (cameraMode === 'FOLLOW' && selected) {
      // ── Chase cam — follows behind and above selected aircraft ─────────
      const { x, y, z } = selected.position;
      const headingRad = THREE.MathUtils.degToRad(selected.heading);

      // Offset: 60 units behind the aircraft, 25 units up
      const offsetX = Math.sin(headingRad) * -60;
      const offsetZ = Math.cos(headingRad) * -60;

      posTarget.current.set(x + offsetX, y + 30 + selected.position.y * 0.5, z + offsetZ);
      lookTarget.current.set(x, y + 2, z);

    } else if (cameraMode === 'RUNWAY') {
      // ── Side-on runway view ────────────────────────────────────────────
      posTarget.current.copy(RUNWAY_POS);

      // Lock onto the most active landing/takeoff aircraft if any
      const activeOnRunway = flights.find(f =>
        ['APPROACH','LANDING','TAKEOFF','LINE_UP'].includes(f.phase)
      );
      if (activeOnRunway) {
        lookTarget.current.set(
          activeOnRunway.position.x,
          activeOnRunway.position.y,
          activeOnRunway.position.z
        );
      } else {
        lookTarget.current.set(0, 5, 0);
      }

    } else if (cameraMode === 'FOLLOW' && !selected) {
      // Follow mode but no selection — fall back to tower
      posTarget.current.copy(TOWER_POS);
      lookTarget.current.copy(TOWER_LOOK);
    }

    // ── Smooth the camera toward its target ─────────────────────────────
    camera.position.lerp(posTarget.current, lerpT);

    // Look-at via smooth slerp of quaternion
    const desiredQuat = new THREE.Quaternion();
    const tempM = new THREE.Matrix4();
    tempM.lookAt(camera.position, lookTarget.current, camera.up);
    desiredQuat.setFromRotationMatrix(tempM);
    camera.quaternion.slerp(desiredQuat, lerpT);
  });

  return null; // Logic only — no rendered elements needed
}
