// dataStore.js — In-memory flight registry
// This is the single source of truth for all active aircraft on the ground

const AIRLINES = [
  { code: 'BAW', name: 'British Airways', color: '#003580' },
  { code: 'EZY', name: 'easyJet',        color: '#ff6600' },
  { code: 'RYR', name: 'Ryanair',        color: '#003399' },
  { code: 'DLH', name: 'Lufthansa',      color: '#05164d' },
  { code: 'UAE', name: 'Emirates',       color: '#c8102e' },
  { code: 'SIA', name: 'Singapore Air',  color: '#1a3668' },
  { code: 'AFR', name: 'Air France',     color: '#002395' },
];

const RUNWAYS = ['27R', '27L', '09R'];
const STANDS  = ['A1','A2','A3','B1','B2','B3','B4','C1','C2','C3'];

// All currently active flights on the airfield
let flights = new Map();

let _idCounter = 100;
function generateId(airlineCode) {
  _idCounter++;
  return `${airlineCode}${_idCounter}`;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Create a brand-new flight starting from the APPROACH phase.
 * The simulation engine will evolve its state over time.
 */
function createNewFlight() {
  const airline = randomFrom(AIRLINES);
  const id = generateId(airline.code);
  const now = new Date();

  // Arrival is "now", departure roughly 1-3 hours later
  const schedArr  = new Date(now.getTime() - 3 * 60 * 1000);           // 3 min ago
  const actualArr = new Date(now.getTime() - (Math.random() * 2 * 60 * 1000)); // 0-2 min ago
  const schedDep  = new Date(now.getTime() + (60 + Math.random() * 120) * 60 * 1000);

  const flight = {
    id,
    airline: airline.name,
    airlineCode: airline.code,
    airlineColor: airline.color,
    runway: randomFrom(RUNWAYS),
    stand: randomFrom(STANDS),
    phase: 'WAITING',
    approvedForLanding: false,
    // Position starts far out on the approach (z is km equivalent, x = lateral offset)
    position: { x: (Math.random() - 0.5) * 10, y: 120, z: 600 },
    heading: 270, // Facing West (landing on RW27)
    speed: 145,   // Knots equivalent
    // How long has this flight been in its current phase (seconds)
    phaseTimer: 0,
    // Progress 0.0 → 1.0 along the current phase's path
    progress: 0,
    scheduledArrival:    schedArr.toISOString(),
    actualArrival:       actualArr.toISOString(),
    scheduledDeparture:  schedDep.toISOString(),
    actualDeparture:     null,
  };

  flights.set(id, flight);
  return flight;
}

/** Seed the store with some initial flights in various phases for instant demo */
function seedFlights() {
  // Spawn flights on the ground and in a waiting pattern only.
  const phases = [
    'WAITING',
    'AT_STAND', 'TAXI_OUT', 'TAKEOFF'
  ];
  phases.forEach((phase) => {
    const f = createNewFlight();
    f.phase = phase;
    f.phaseTimer = Math.random() * 5; // Mid-phase
    // Give them realistic initial positions based on phase
    applyInitialPositionForPhase(f, phase);
  });
}

function applyInitialPositionForPhase(f, phase) {
  switch(phase) {
    case 'WAITING':     f.position = { x: 50, y: 200, z: 400 }; f.speed = 180; break;
    case 'APPROACH':    f.position = { x: 5,  y: 80, z: 500 }; f.speed = 145; break;
    case 'LANDING':     f.position = { x: 0,  y: 5,  z: 50  }; f.speed = 120; break;
    case 'ROLL_OUT':    f.position = { x: 0,  y: 0,  z: -50 }; f.speed = 60;  break;
    case 'RUNWAY_EXIT': f.position = { x: 30, y: 0,  z: -80 }; f.speed = 20;  break;
    case 'TAXI_IN':     f.position = { x: 60, y: 0,  z: -50 }; f.speed = 12;  break;
    case 'AT_STAND':    f.position = { x: 100,y: 0,  z: 20  }; f.speed = 0;   break;
    case 'PUSHBACK':    f.position = { x: 95, y: 0,  z: 30  }; f.speed = 5;   break;
    case 'TAXI_OUT':    f.position = { x: 70, y: 0,  z: 10  }; f.speed = 12;  break;
    case 'LINE_UP':     f.position = { x: 10, y: 0,  z: 20  }; f.speed = 8;   break;
    case 'TAKEOFF':     f.position = { x: 0,  y: 10, z: 30  }; f.speed = 100; break;
  }
}

function getAll()  { return Array.from(flights.values()); }
function getById(id) { return flights.get(id) || null; }
function set(flight) { flights.set(flight.id, flight); }
function remove(id) { flights.delete(id); }
function size() { return flights.size; }

module.exports = { getAll, getById, set, remove, size, createNewFlight, seedFlights };
