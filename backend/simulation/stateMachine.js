// stateMachine.js — Real-world airport phase simulation engine
// Every phase carries real ICAO/FAA measurement parameters identical to actual
// airline operations: ILS deviations, Vref speeds, brake temperatures, G-forces,
// reverse thrust, gear states, ATC clearances, and runway occupancy timers.

// ─────────────────────────────────────────────────────────────────────────────
// PHASE SEQUENCE
// APPROACH → LANDING → ROLL_OUT → RUNWAY_EXIT → TAXI_IN →
// AT_STAND → PUSHBACK → TAXI_OUT → LINE_UP → TAKEOFF → (depart)
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_DURATIONS = {
  WAITING:       20,
  APPROACH:      30,
  LANDING:       10,
  ROLL_OUT:      15,
  RUNWAY_EXIT:   12,
  TAXI_IN:       25,
  AT_STAND:      40,
  PUSHBACK:      12,
  TAXI_OUT:      35,
  LINE_UP:        8,
  TAKEOFF:       18,
};

const PHASE_ORDER = Object.keys(PHASE_DURATIONS);

// Wind data - updated by engine to avoid circular dependency
let _currentWinds = { direction: 270, speed: 12, gusts: 18 };
function setCurrentWinds(w) { _currentWinds = { ...w }; }


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(min, max) { return Math.random() * (max - min) + min; }

// ATC message templates per phase transition
const ATC_MESSAGES = {
  WAITING_ENTRY:      (f) => `${f.id}, Heathrow Approach, squawk ${f.squawk}, expect ILS runway ${f.runway}, maintain 3000 ft.`,
  APPROACH_ENTRY:     (f) => `${f.id}, cleared ILS approach runway ${f.runway}, report outer marker.`,
  LANDING_ENTRY:      (f) => `${f.id}, wind ${Math.round(f.windDirection)}° at ${Math.round(f.windSpeed)} knots, runway ${f.runway} cleared to land.`,
  ROLL_OUT_ENTRY:     (f) => `${f.id}, vacate runway via Echo, contact Ground 121.9.`,
  RUNWAY_EXIT_ENTRY:  (f) => `${f.id}, roger, taxiing to stand ${f.stand}.`,
  TAXI_IN_ENTRY:      (f) => `${f.id}, Heathrow Ground, taxi to stand ${f.stand}, via Alpha, Bravo.`,
  AT_STAND_ENTRY:     (f) => `${f.id}, stand ${f.stand} confirmed, chocks in, engines shutdown.`,
  PUSHBACK_ENTRY:     (f) => `${f.id}, pushback approved, face East, QNH 1013.`,
  TAXI_OUT_ENTRY:     (f) => `${f.id}, taxi runway ${f.runway} via Lima, hold short of runway.`,
  LINE_UP_ENTRY:      (f) => `${f.id}, line up and wait runway ${f.runway}.`,
  TAKEOFF_ENTRY:      (f) => `${f.id}, wind ${Math.round(f.windDirection)}° at ${Math.round(f.windSpeed)} knots, runway ${f.runway} cleared for takeoff.`,
};

function addAtcMessage(flight, template) {
  if (!template) return;
  const msg = template(flight);
  if (!flight.atcLog) flight.atcLog = [];
  flight.atcLog.push({
    time: new Date().toISOString(),
    from: 'ATC',
    msg,
  });
  flight.atcClearance = msg;
  // Keep log max 20 entries
  if (flight.atcLog.length > 20) flight.atcLog.shift();
}

// ─────────────────────────────────────────────────────────────────────────────
// Position (scene units)
// ─────────────────────────────────────────────────────────────────────────────
function getRunwayOffset(runway) {
  if (runway === '27L') return -200;
  if (runway === '27C') return -100;
  if (runway === '27R') return 0;
  if (runway === '28L') return 420;
  if (runway === '28R') return 540;
  return 0;
}

function getTargetPosition(phase, progress, flight) {
  const standLetter = flight.stand.charCodeAt(0) - 65;
  const standNum    = parseInt(flight.stand[1] || '1');
  const standX = 200 + standLetter * 22;
  const standZ = -30 + standNum * 22;
  const rwX    = getRunwayOffset(flight.runway);
  const twyX   = rwX > 200 ? 310 : 180;
  const holdDir = rwX > 200 ? -30 : 30; // Approach from the left vs right

  switch (phase) {
    case 'WAITING':
      return {
        x: Math.sin(progress * Math.PI * 2) * 100,
        y: 200,
        z: 450 + Math.cos(progress * Math.PI * 2) * 100,
      };

    case 'APPROACH':
      return { x: rwX, y: lerp(120, 8, progress), z: lerp(450, 180, progress) };

    case 'LANDING':
      return { x: rwX, y: lerp(8, 0, progress), z: lerp(180, 80, progress) };

    case 'ROLL_OUT':
      return { x: rwX, y: 0, z: lerp(80, -100, progress) };

    case 'RUNWAY_EXIT':
      return { x: lerp(rwX, twyX, progress), y: 0, z: -100 };

    case 'TAXI_IN': {
      if (progress < 0.6) {
        const p = progress / 0.6;
        return { x: twyX, y: 0, z: lerp(-100, 0, p) };
      } else {
        const p = (progress - 0.6) / 0.4;
        return { x: lerp(twyX, standX, p), y: 0, z: lerp(0, standZ, p) };
      }
    }

    case 'AT_STAND':
      return { x: standX, y: 0, z: standZ };

    case 'PUSHBACK':
      return { x: lerp(standX, standX - 10, progress), y: 0, z: lerp(standZ, standZ + 5, progress) };

    case 'TAXI_OUT': {
      if (progress < 0.3) {
        const p = progress / 0.3;
        return { x: lerp(standX - 10, twyX, p), y: 0, z: lerp(standZ + 5, 0, p) };
      } else if (progress < 0.8) {
        const p = (progress - 0.3) / 0.5;
        return { x: twyX, y: 0, z: lerp(0, 140, p) };
      } else {
        const p = (progress - 0.8) / 0.2;
        return { x: lerp(twyX, rwX + holdDir, p), y: 0, z: 140 }; // Directly to runway threshold
      }
    }

    case 'LINE_UP':
      return { x: lerp(rwX + holdDir, rwX, progress), y: 0, z: lerp(140, 130, progress) };

    case 'TAKEOFF':
      return {
        x: rwX,
        y: lerp(0, 100, progress * progress),
        z: lerp(130, -500, progress),
      };

    default:
      return { ...flight.position };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Speed (knots)
// ─────────────────────────────────────────────────────────────────────────────
function getTargetSpeed(phase, progress, flight) {
  const vref = flight.vref || 140;
  const vr   = flight.rotateSpeed || 148;

  switch (phase) {
    case 'WAITING':     return 190;
    case 'APPROACH':    return lerp(180, vref + 20, progress);  // 180 → Vref+20 (final approach)
    case 'LANDING':     return lerp(vref + 10, vref - 10, progress); // touchdown just below Vref
    case 'ROLL_OUT':    return lerp(vref - 10, 15, progress);   // decel to 15kt
    case 'RUNWAY_EXIT': return lerp(15, 20, progress);
    case 'TAXI_IN':     return 12;
    case 'AT_STAND':    return 0;
    case 'PUSHBACK':    return 4;
    case 'TAXI_OUT':    return 15;
    case 'LINE_UP':     return 8;
    case 'TAKEOFF':     return lerp(0, vr * 1.3, Math.min(progress * 1.2, 1)); // 0 → V2+climb
    default: return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-phase telemetry updater
// ─────────────────────────────────────────────────────────────────────────────
function updateTelemetry(flight, phase, progress, dt) {
  const vref = flight.vref || 140;
  const vr   = flight.rotateSpeed || 148;

  // ── Altitude (feet) ──────────────────────────────────────────────────────
  switch (phase) {
    case 'WAITING':
      flight.altitude = 8000 + Math.sin(progress * Math.PI * 2) * 200;
      break;
    case 'APPROACH':
      flight.altitude = Math.round(lerp(4500, 200, progress));
      // ILS glideslope: 3° descent ~ 318 ft/nm. Simulate small deviations
      flight.glideslopeDeviation  = clamp(rand(-0.3, 0.3) + Math.sin(progress * 10) * 0.1, -2, 2);
      flight.localizerDeviation   = clamp(rand(-0.15, 0.15) + Math.cos(progress * 8) * 0.05, -2, 2);
      break;
    case 'LANDING':
      flight.altitude  = Math.round(lerp(200, 0, progress));
      flight.glideslopeDeviation = 0;
      flight.localizerDeviation  = 0;
      break;
    default:
      if (['ROLL_OUT','RUNWAY_EXIT','TAXI_IN','AT_STAND','PUSHBACK','TAXI_OUT','LINE_UP'].includes(phase))
        flight.altitude = 0;
      else if (phase === 'TAKEOFF')
        flight.altitude = Math.round(lerp(0, 3000, progress * progress));
      break;
  }

  // ── Vertical Speed (fpm) ─────────────────────────────────────────────────
  if (phase === 'APPROACH') {
    // Standard 3° glideslope ~ -700 fpm at approach speed
    flight.verticalSpeed = Math.round(lerp(-300, -750, progress));
  } else if (phase === 'LANDING') {
    // Flare: reduce sink rate to touchdown
    flight.verticalSpeed = Math.round(lerp(-600, -180, progress));
    if (progress > 0.85) {
      // Record touchdown sink rate
      flight.touchdownRate = flight.verticalSpeed;
      flight.touchdownG    = parseFloat((1 + Math.abs(flight.verticalSpeed) / 1800).toFixed(2));
    }
  } else if (phase === 'ROLL_OUT') {
    flight.verticalSpeed = 0;
  } else if (phase === 'TAKEOFF') {
    flight.verticalSpeed = Math.round(lerp(0, 2500, progress));
  } else {
    flight.verticalSpeed = 0;
  }

  // ── Pitch angle ──────────────────────────────────────────────────────────
  if (phase === 'APPROACH') flight.pitchAngle = -3.0;
  else if (phase === 'LANDING') flight.pitchAngle = lerp(-3, 3, progress);  // flare
  else if (phase === 'ROLL_OUT') flight.pitchAngle = lerp(3, 0, progress);
  else if (phase === 'TAKEOFF') flight.pitchAngle = lerp(0, 15, Math.min(progress * 3, 1));
  else if (['TAXI_IN','AT_STAND','PUSHBACK','TAXI_OUT','LINE_UP','RUNWAY_EXIT'].includes(phase)) flight.pitchAngle = 0;

  // ── Flap configuration ───────────────────────────────────────────────────
  if (phase === 'APPROACH') flight.flapsConfig = 30;
  else if (phase === 'LANDING' || phase === 'ROLL_OUT') flight.flapsConfig = 40;
  else if (phase === 'RUNWAY_EXIT') flight.flapsConfig = 25;
  else if (phase === 'TAXI_IN' || phase === 'AT_STAND') flight.flapsConfig = 0;
  else if (phase === 'TAKEOFF') flight.flapsConfig = progress < 0.4 ? 20 : progress < 0.8 ? 10 : 5;
  else if (phase === 'LINE_UP' || phase === 'TAXI_OUT') flight.flapsConfig = 20;

  // ── Gear state ───────────────────────────────────────────────────────────
  if (['WAITING'].includes(phase)) flight.gearState = 'UP';
  else if (phase === 'APPROACH' && progress > 0.4) flight.gearState = progress < 0.5 ? 'TRANSIT' : 'DOWN';
  else if (['LANDING','ROLL_OUT','RUNWAY_EXIT','TAXI_IN','AT_STAND','PUSHBACK','TAXI_OUT','LINE_UP'].includes(phase)) flight.gearState = 'DOWN';
  else if (phase === 'TAKEOFF') {
    if (progress < 0.25) flight.gearState = 'DOWN';
    else if (progress < 0.40) flight.gearState = 'TRANSIT';
    else flight.gearState = 'UP';
  }

  // ── Engine N1 % ──────────────────────────────────────────────────────────
  if (phase === 'WAITING') flight.engineN1 = [88, 88];
  else if (phase === 'APPROACH') flight.engineN1 = [55, 55];
  else if (phase === 'LANDING') flight.engineN1 = [38, 38];
  else if (phase === 'ROLL_OUT') {
    // Thrust reverse deployed
    const pct = lerp(85, 20, progress);
    flight.engineN1 = [Math.round(pct), Math.round(pct)];
    flight.thrustReverse = progress < 0.7;
  } else if (phase === 'RUNWAY_EXIT') {
    flight.thrustReverse = false;
    flight.engineN1 = [28, 28];
  } else if (phase === 'TAXI_IN' || phase === 'TAXI_OUT' || phase === 'RUNWAY_EXIT') {
    flight.engineN1 = [25, 25];
  } else if (phase === 'AT_STAND') {
    flight.engineN1 = [0, 0]; // Engines off at stand
  } else if (phase === 'PUSHBACK') {
    flight.engineN1 = [18, 18]; // Starting engines during pushback
  } else if (phase === 'LINE_UP') {
    flight.engineN1 = [40, 40];
  } else if (phase === 'TAKEOFF') {
    const n1 = lerp(40, 97, Math.min(progress * 2, 1)); // TOGA thrust
    flight.engineN1 = [Math.round(n1), Math.round(n1)];
    flight.thrustReverse = false;
  }

  // ── Brake pressure & temperature ─────────────────────────────────────────
  if (phase === 'ROLL_OUT') {
    flight.brakePressure = Math.round(lerp(0, 2400, Math.min(progress * 1.5, 1)));
    // Brake temperature rises during heavy braking
    const heatRate = 25 * dt;
    flight.brakeTemp = flight.brakeTemp.map(t => Math.min(t + heatRate, 700));
    flight.decelerationG = parseFloat(lerp(0.15, 0.45, progress).toFixed(2));
  } else if (phase === 'TAXI_IN' || phase === 'TAXI_OUT') {
    flight.brakePressure = 200; // Slight taxi braking
    // Brakes cool during taxi
    const coolRate = 5 * dt;
    flight.brakeTemp = flight.brakeTemp.map(t => Math.max(t - coolRate, 150));
    flight.decelerationG = 0;
  } else if (phase === 'AT_STAND') {
    flight.brakePressure = 3000; // Parking brake
    const coolRate = 10 * dt;
    flight.brakeTemp = flight.brakeTemp.map(t => Math.max(t - coolRate, 80));
    flight.decelerationG = 0;
  } else if (phase === 'TAKEOFF') {
    flight.brakePressure = 0;
    flight.decelerationG = 0;
    // Brakes heat slightly from takeoff heat
    if (progress < 0.1) flight.brakeTemp = flight.brakeTemp.map(t => Math.min(t + 3 * dt, 220));
  } else {
    flight.brakePressure = 0;
    flight.decelerationG = 0;
  }

  // ── Runway occupancy timer ────────────────────────────────────────────────
  if (['LANDING', 'ROLL_OUT', 'LINE_UP', 'TAKEOFF'].includes(phase)) {
    flight.runwayOccupied = true;
    flight.runwayOccupancyTimer = (flight.runwayOccupancyTimer || 0) + dt;
  } else if (phase === 'RUNWAY_EXIT' && progress > 0.5) {
    flight.runwayOccupied = false;
  } else if (!['LANDING','ROLL_OUT','LINE_UP','TAKEOFF'].includes(phase)) {
    if (phase !== 'LANDING') flight.runwayOccupied = false;
  }

  // ── Ground speed / TAS / Mach ────────────────────────────────────────────
  flight.groundSpeed = Math.round(flight.speed);
  flight.trueAirspeed = Math.round(flight.speed * (1 + flight.altitude / 100000));
  flight.mach = parseFloat((flight.trueAirspeed / 660).toFixed(2));

  // ── G-force ──────────────────────────────────────────────────────────────
  if (phase === 'TAKEOFF' && progress > 0.4 && progress < 0.55) {
    flight.gForce = parseFloat((1 + Math.sin(progress * 8) * 0.2).toFixed(2)); // rotation bump
  } else if (phase === 'LANDING' && progress > 0.85) {
    flight.gForce = flight.touchdownG || 1.1;
  } else if (phase === 'ROLL_OUT') {
    flight.gForce = parseFloat((1 + flight.decelerationG * 0.5).toFixed(2));
  } else {
    flight.gForce = 1.0;
  }

  // ── Wind component update — winds injected via setCurrentWinds() ──────────
  const relAngle = ((_currentWinds.direction - 270) + 360) % 360;
  flight.windDirection = _currentWinds.direction;
  flight.windSpeed     = _currentWinds.speed;
  flight.headwindComp  = parseFloat((_currentWinds.speed * Math.cos(relAngle * Math.PI / 180)).toFixed(1));
  flight.crosswindComp = parseFloat((_currentWinds.speed * Math.sin(relAngle * Math.PI / 180)).toFixed(1));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase entry handler - fires ATC message and logs phase timestamp
// ─────────────────────────────────────────────────────────────────────────────
function onPhaseEntry(flight, newPhase) {
  flight.phaseTimestamps = flight.phaseTimestamps || {};
  flight.phaseTimestamps[newPhase] = new Date().toISOString();

  const templates = {
    WAITING:      ATC_MESSAGES.WAITING_ENTRY,
    APPROACH:     ATC_MESSAGES.APPROACH_ENTRY,
    LANDING:      ATC_MESSAGES.LANDING_ENTRY,
    ROLL_OUT:     ATC_MESSAGES.ROLL_OUT_ENTRY,
    RUNWAY_EXIT:  ATC_MESSAGES.RUNWAY_EXIT_ENTRY,
    TAXI_IN:      ATC_MESSAGES.TAXI_IN_ENTRY,
    AT_STAND:     ATC_MESSAGES.AT_STAND_ENTRY,
    PUSHBACK:     ATC_MESSAGES.PUSHBACK_ENTRY,
    TAXI_OUT:     ATC_MESSAGES.TAXI_OUT_ENTRY,
    LINE_UP:      ATC_MESSAGES.LINE_UP_ENTRY,
    TAKEOFF:      ATC_MESSAGES.TAKEOFF_ENTRY,
  };
  if (templates[newPhase]) addAtcMessage(flight, templates[newPhase]);

  // Record actual departure time
  if (newPhase === 'TAKEOFF') {
    flight.actualDeparture = new Date().toISOString();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tick function
// ─────────────────────────────────────────────────────────────────────────────
function tick(flight, dt) {
  // Transition out of WAITING when approved
  if (flight.phase === 'WAITING' && flight.approvedForLanding) {
    const nextPhase = 'APPROACH';
    onPhaseEntry(flight, nextPhase);
    flight.phase     = nextPhase;
    flight.phaseTimer = 0;
    flight.progress  = 0;
  }

  const duration = PHASE_DURATIONS[flight.phase] || 20;
  flight.phaseTimer += dt;
  const progress = Math.min(flight.phaseTimer / duration, 1);
  flight.progress = progress;

  // Position
  const target = getTargetPosition(flight.phase, progress, flight);
  const posSmoothing = flight.phase === 'AT_STAND' ? 1 : Math.min(dt * 2.5, 1);
  flight.position.x += (target.x - flight.position.x) * posSmoothing;
  flight.position.y += (target.y - flight.position.y) * posSmoothing;
  flight.position.z += (target.z - flight.position.z) * posSmoothing;

  // Speed
  flight.speed = getTargetSpeed(flight.phase, progress, flight);

  // All telemetry
  updateTelemetry(flight, flight.phase, progress, dt);

  // Heading
  let targetHeading = flight.heading;
  if (flight.phase === 'AT_STAND' || flight.phase === 'PUSHBACK') {
    targetHeading = 0;
  } else if (['APPROACH','LANDING','ROLL_OUT','TAKEOFF'].includes(flight.phase)) {
    targetHeading = 270;
  } else {
    const dx = target.x - flight.position.x;
    const dz = target.z - flight.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      targetHeading = (Math.atan2(dz, dx) * (180 / Math.PI) + 360) % 360;
    }
  }

  const headingDiff = ((targetHeading - flight.heading + 540) % 360) - 180;
  flight.heading = (flight.heading + headingDiff * Math.min(dt * 2.5, 1) + 360) % 360;

  // Phase transition
  if (progress >= 1) {
    if (flight.phase === 'WAITING' && !flight.approvedForLanding) {
      flight.phaseTimer = 0;
      flight.progress   = 0;
      return false; // Loop holding pattern
    }

    // Hold only for taxi-out (pushback) from stands. Arriving planes taxi in automatically once off the runway.
    if (flight.phase === 'AT_STAND' && !flight.approvedForTaxi) {
      flight.phaseTimer = duration;
      flight.progress = 1; 
      return false; // Hold at stand for pushback/taxi clearance
    }

    if (flight.phase === 'TAXI_OUT' && !flight.approvedForTakeoff) {
      flight.phaseTimer = duration;
      flight.progress = 1;
      return false; // Hold at the runway hold-short line until takeoff is approved
    }
    const currentIndex = PHASE_ORDER.indexOf(flight.phase);
    if (currentIndex === PHASE_ORDER.length - 1) {
      return true; // TAKEOFF complete — remove
    }

    const nextPhase = PHASE_ORDER[currentIndex + 1];
    if (nextPhase === 'AT_STAND') {
      flight.approvedForTaxi = false; 
    }
    
    onPhaseEntry(flight, nextPhase);
    flight.phase     = nextPhase;
    flight.phaseTimer = 0;
    flight.progress  = 0;
  }

  return false;
}

module.exports = { tick, PHASE_DURATIONS, PHASE_ORDER, setCurrentWinds };
