// stateMachine.js — Defines all phase transitions and position/speed logic
// Think of this as the "rules engine" for aircraft behaviour

// ─────────────────────────────────────────────────────────────────────────────
// PHASE SEQUENCE  (matches the canonical state machine)
// APPROACH → LANDING → ROLL_OUT → RUNWAY_EXIT → TAXI_IN →
// AT_STAND → PUSHBACK → TAXI_OUT → LINE_UP → TAKEOFF → (removed / respawn)
// ─────────────────────────────────────────────────────────────────────────────

// How many seconds each phase nominally lasts before advancing to the next one
const PHASE_DURATIONS = {
  WAITING:      20,
  APPROACH:     30,
  LANDING:      10,
  ROLL_OUT:     15,
  RUNWAY_EXIT:  12,
  TAXI_IN:      25,
  AT_STAND:     40,   // Park for 40 s then the crew is ready
  PUSHBACK:     12,
  TAXI_OUT:     35,   // Takes longer to taxi all the way to start of runway
  LINE_UP:       8,
  TAKEOFF:      18,
};

const PHASE_ORDER = Object.keys(PHASE_DURATIONS);

/**
 * Compute the target position for a given flight + phase progress (0 → 1).
 * All coordinates are unitless "scene units" matching the Three.js scene.
 * The airport layout:
 *   Runway 27R: runs along Z axis (z = -240 to z = 240), x ≈ 0
 *   Terminal:   x ≈ 100, z = -20 → 60
 *   BOTH LANDING AND TAKEOFF operate towards -Z (North)
 */
function getTargetPosition(phase, progress, flight) {
  const lerp = (a, b, t) => a + (b - a) * t;

  const standLetter = flight.stand.charCodeAt(0) - 65; // A=0, B=1, C=2
  const standNum = parseInt(flight.stand[1] || '1'); // 1, 2, 3, 4
  const standX = 200 + standLetter * 22;
  const standZ = -30 + standNum * 22;

  switch (phase) {
    case 'WAITING':
      // Holding pattern high above the approach path until approved
      const r = 100;
      return { 
        x: Math.sin(progress * Math.PI * 2) * r, 
        y: 200, 
        z: 450 + Math.cos(progress * Math.PI * 2) * r 
      };

    // ── LANDING RUNWAY (Left, x=0, pointing North/-Z) ──
    case 'APPROACH':
      return { x: 0, y: lerp(120, 8, progress), z: lerp(450, 180, progress) };

    case 'LANDING':
      return { x: 0, y: lerp(8, 0, progress), z: lerp(180, 80, progress) };

    case 'ROLL_OUT':
      return { x: 0, y: 0, z: lerp(80, -100, progress) };

    case 'RUNWAY_EXIT':
      // Cross horizontally from landing runway (0) over takeoff runway (70) to the vertical taxiway (180)
      // Exit point: z = -100 (top horizontal taxiway path)
      return { x: lerp(0, 180, progress), y: 0, z: -100 };

    case 'TAXI_IN': {
      // Travel down the vertical taxiway (180) from z=-100 to z=0, then enter terminal
      if (progress < 0.6) {
        const p = progress / 0.6;
        return { x: 180, y: 0, z: lerp(-100, 0, p) };
      } else {
        const p = (progress - 0.6) / 0.4;
        return { x: lerp(180, standX, p), y: 0, z: lerp(0, standZ, p) };
      }
    }

    case 'AT_STAND': 
      return { x: standX, y: 0, z: standZ };

    // ── TAKEOFF RUNWAY (Right, x=70, pointing South/+Z) ──
    case 'PUSHBACK': 
      // Reverse slightly from gate
      return { x: lerp(standX, standX - 10, progress), y: 0, z: lerp(standZ, standZ + 5, progress) };

    case 'TAXI_OUT': {
      // 1. Move from stand to the central connector at x=180, z=0
      // 2. Travel down vertical taxiway x=180 to z=140
      // 3. Cross horizontally to takeoff runway x=70
      if (progress < 0.3) {
        const p = progress / 0.3;
        return { x: lerp(standX - 10, 180, p), y: 0, z: lerp(standZ + 5, 0, p) };
      } else if (progress < 0.8) {
        const p = (progress - 0.3) / 0.5;
        return { x: 180, y: 0, z: lerp(0, 140, p) };
      } else {
        const p = (progress - 0.8) / 0.2;
        return { x: lerp(180, 70, p), y: 0, z: 140 };
      }
    }

    case 'LINE_UP':
      // Align onto runway heading for takeoff pointing -Z (North) at the bottom cross connector
      return { x: 70, y: 0, z: lerp(140, 130, progress) };

    case 'TAKEOFF':
      // Accelerate down the right runway and climb away (North)
      return {
        x: 70,
        y: lerp(0, 100, progress * progress),
        z: lerp(130, -500, progress),
      };

    default:
      return { ...flight.position };
  }
}

/**
 * Get the target airspeed (knots equivalent) for a phase + progress.
 */
function getTargetSpeed(phase, progress) {
  switch (phase) {
    case 'WAITING':      return 180;
    case 'APPROACH':     return 145 - progress * 50;   // 145 → 95
    case 'LANDING':      return 130 - progress * 60;   // 130 → 70
    case 'ROLL_OUT':     return 70  - progress * 55;   // 70  → 15
    case 'RUNWAY_EXIT':  return 20;
    case 'TAXI_IN':      return 12;
    case 'AT_STAND':     return 0;
    case 'PUSHBACK':     return 5;
    case 'TAXI_OUT':     return 15;
    case 'LINE_UP':      return 8;
    case 'TAKEOFF':      return 20 + progress * 140;   // 20 → 160
    default: return 0;
  }
}

/**
 * Advance a single flight's state machine by `dt` seconds.
 * Mutates the flight object in-place.
 * Returns true if the flight has completed its final phase and should be removed.
 */
function tick(flight, dt) {
  // Directly transition out of holding pattern if freshly approved
  if (flight.phase === 'WAITING' && flight.approvedForLanding) {
    flight.phase = 'APPROACH';
    flight.phaseTimer = 0;
    flight.progress = 0;
  }

  const duration = PHASE_DURATIONS[flight.phase] || 20;
  flight.phaseTimer += dt;

  // Progress is 0..1 within the current phase
  const progress = Math.min(flight.phaseTimer / duration, 1);
  flight.progress = progress;

  // Update position toward the phase's target
  const target = getTargetPosition(flight.phase, progress, flight);
  
  // Smooth toward target (server-side lerp for realistic movement)
  const posSmoothing = flight.phase === 'AT_STAND' ? 1 : Math.min(dt * 2.5, 1);
  flight.position.x += (target.x - flight.position.x) * posSmoothing;
  flight.position.y += (target.y - flight.position.y) * posSmoothing;
  flight.position.z += (target.z - flight.position.z) * posSmoothing;

  // Update speed
  flight.speed = getTargetSpeed(flight.phase, progress);

  // Dynamic heading calculation algorithm
  let targetHeading = flight.heading;
  if (flight.phase === 'AT_STAND') {
    targetHeading = 0; // Nose strictly toward terminal +X
  } else if (flight.phase === 'PUSHBACK') {
    targetHeading = 0; // Keep nose toward terminal in reverse
  } else if (['APPROACH', 'LANDING', 'ROLL_OUT', 'LINE_UP', 'TAKEOFF'].includes(flight.phase)) {
    targetHeading = 270; // strictly aligned with runways (-Z, North)
  } else {
    // TAXI_IN, RUNWAY_EXIT, TAXI_OUT: Calculate heading off vector path
    const dx = target.x - flight.position.x;
    const dz = target.z - flight.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      let angle = Math.atan2(dz, dx) * (180 / Math.PI);
      targetHeading = (angle + 360) % 360;
    }
  }

  // Calculate shortest path diff 
  const headingDiff = ((targetHeading - flight.heading + 540) % 360) - 180;
  
  // Apply rotation
  flight.heading = (flight.heading + headingDiff * Math.min(dt * 2.5, 1) + 360) % 360;

  // ── Phase transition ──────────────────────────────────────────────────────
  if (progress >= 1) {
    if (flight.phase === 'WAITING' && !flight.approvedForLanding) {
      // Loop the holding pattern indefinitely
      flight.phaseTimer = 0;
      flight.progress = 0;
      return false;
    }

    const currentIndex = PHASE_ORDER.indexOf(flight.phase);
    if (currentIndex === PHASE_ORDER.length - 1) {
      // TAKEOFF complete — flight has departed. Signal removal.
      return true;
    }
    // Advance to next phase
    flight.phase = PHASE_ORDER[currentIndex + 1];
    flight.phaseTimer = 0;
    flight.progress   = 0;
  }

  return false; // Still active
}

module.exports = { tick, PHASE_DURATIONS, PHASE_ORDER };
