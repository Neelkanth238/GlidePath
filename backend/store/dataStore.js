// dataStore.js — In-memory flight registry
// Single source of truth for all active aircraft: full ICAO-grade telemetry

const AIRLINES = [
  { code: 'BAW', name: 'British Airways',  color: '#003580', iata: 'BA' },
  { code: 'EZY', name: 'easyJet',          color: '#ff6600', iata: 'U2' },
  { code: 'RYR', name: 'Ryanair',          color: '#003399', iata: 'FR' },
  { code: 'DLH', name: 'Lufthansa',        color: '#05164d', iata: 'LH' },
  { code: 'UAE', name: 'Emirates',         color: '#c8102e', iata: 'EK' },
  { code: 'SIA', name: 'Singapore Air',    color: '#1a3668', iata: 'SQ' },
  { code: 'AFR', name: 'Air France',       color: '#002395', iata: 'AF' },
  { code: 'QTR', name: 'Qatar Airways',    color: '#5c0632', iata: 'QR' },
  { code: 'THY', name: 'Turkish Airlines', color: '#c8102e', iata: 'TK' },
];

const AIRCRAFT_TYPES = [
  { type: 'A320', name: 'Airbus A320',      weightClass: 'MEDIUM', maxFuelKg: 18000, vref: 138, rotate: 145, mtow: 77000 },
  { type: 'B738', name: 'Boeing 737-800',   weightClass: 'MEDIUM', maxFuelKg: 20900, vref: 140, rotate: 148, mtow: 79015 },
  { type: 'A388', name: 'Airbus A380',      weightClass: 'HEAVY',  maxFuelKg: 250000,vref: 155, rotate: 162, mtow: 560000 },
  { type: 'B77W', name: 'Boeing 777-300ER', weightClass: 'HEAVY',  maxFuelKg: 145000,vref: 152, rotate: 158, mtow: 351533 },
  { type: 'A359', name: 'Airbus A350-900',  weightClass: 'HEAVY',  maxFuelKg: 140000,vref: 148, rotate: 155, mtow: 280000 },
  { type: 'B763', name: 'Boeing 767-300',   weightClass: 'HEAVY',  maxFuelKg: 90700, vref: 142, rotate: 150, mtow: 186880 },
  { type: 'A21N', name: 'Airbus A321neo',   weightClass: 'MEDIUM', maxFuelKg: 26700, vref: 141, rotate: 148, mtow: 97000  },
];

const AIRPORTS_ORIGINS = [
  'EGLL','LFPG','EHAM','EDDF','LEMD','LEBL','LIRF','EPWA','LTBA','OMDB',
  'KJFK','KLAX','KSFO','KATL','KORD','EGBB','EGCC','EGPH','EIDW','LSZH'
];

const RUNWAYS = ['27R', '27L', '09R'];
const STANDS  = ['A1','A2','A3','B1','B2','B3','B4','C1','C2','C3'];

// All currently active flights on the airfield
let flights = new Map();
let _idCounter = 100;

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min, max) { return Math.random() * (max - min) + min; }

function generateSquawk() {
  // Realistic squawk: 4 octal digits
  const modes = ['7000','7001','7002','4201','4202','4101','3001','2001','1234','5501'];
  return randomFrom(modes) || `${randomInt(1,7)}${randomInt(0,7)}${randomInt(0,7)}${randomInt(0,7)}`;
}

function generateId(airlineCode) {
  _idCounter++;
  const num = randomInt(100, 999);
  return `${airlineCode}${num}`;
}

// Simulates real wind conditions (refreshed slowly)
let currentWinds = { direction: 270, speed: 12, gusts: 18 };
setInterval(() => {
  // Slowly drift wind
  currentWinds.direction = ((currentWinds.direction + randomFloat(-5, 5)) + 360) % 360;
  currentWinds.speed     = Math.max(0, currentWinds.speed + randomFloat(-2, 2));
  currentWinds.gusts     = Math.max(currentWinds.speed, currentWinds.speed + randomFloat(0, 8));
}, 10000);

function getWinds() { return { ...currentWinds }; }

/**
 * Create a brand-new flight starting from the WAITING phase.
 */
function createNewFlight() {
  const airline  = randomFrom(AIRLINES);
  const acType   = randomFrom(AIRCRAFT_TYPES);
  const id       = generateId(airline.code);
  const now      = new Date();

  const fuelKg        = Math.floor(acType.maxFuelKg * randomFloat(0.35, 0.85));
  const payloadKg     = randomInt(8000, 25000);
  const grossWeightKg = randomInt(
    Math.floor(acType.mtow * 0.55),
    Math.floor(acType.mtow * 0.92)
  );

  const schedArr  = new Date(now.getTime() - 3 * 60 * 1000);
  const actualArr = new Date(now.getTime() - (Math.random() * 2 * 60 * 1000));
  const schedDep  = new Date(now.getTime() + (60 + Math.random() * 120) * 60 * 1000);

  // ILS approach data
  const ilsFrequency  = `${(108 + Math.random() * 3.9).toFixed(2)} MHz`;
  const vref          = acType.vref + randomInt(-5, 5);  // Actual Vref for this weight
  const rotateSpeed   = acType.rotate + randomInt(-3, 3);

  // ATC message log — real ATC phraseology
  const atcLog = [
    { time: new Date(now.getTime() - 8*60000).toISOString(), from:'PILOT',  msg:`${airline.iata} control, ${id}, inbound from ${randomFrom(AIRPORTS_ORIGINS)}, request approach.` },
    { time: new Date(now.getTime() - 7*60000).toISOString(), from:'ATC',    msg:`${id}, Heathrow Approach, radar contact, descend FL080, QNH 1013.` },
    { time: new Date(now.getTime() - 5*60000).toISOString(), from:'PILOT',  msg:`Descending FL080, QNH 1013, ${id}.` },
  ];

  const flight = {
    id,
    airline: airline.name,
    airlineCode: airline.code,
    airlineColor: airline.color,
    iata: airline.iata,

    // Aircraft
    aircraftType: acType.type,
    aircraftName: acType.name,
    weightClass:  acType.weightClass,
    grossWeightKg,
    fuelKg,
    payloadKg,
    vref,
    rotateSpeed,

    // Routing
    origin:      randomFrom(AIRPORTS_ORIGINS),
    destination: 'EGLL',
    runway:      randomFrom(RUNWAYS),
    stand:       randomFrom(STANDS),

    // Squawk / transponder
    squawk:      generateSquawk(),

    // ILS
    ilsFrequency,
    glideslopeAngle: 3.0,          // degrees (standard ILS)
    localizerDeviation: 0,         // dots (0 = centred)
    glideslopeDeviation: 0,        // dots

    // Phase state
    phase:              'WAITING',
    approvedForLanding: false,
    position:  { x: (Math.random() - 0.5) * 10, y: 120, z: 600 },
    heading:   270,
    speed:     145,
    phaseTimer: 0,
    progress:   0,
    altitude:   12000,   // feet

    // Real-time measurements (updated by stateMachine)
    verticalSpeed:    0,     // fpm
    groundSpeed:      0,     // knots
    trueAirspeed:     145,
    mach:             0.0,
    gForce:           1.0,
    pitchAngle:       0,     // degrees (nose up positive)
    bankAngle:        0,
    flapsConfig:      0,     // 0-40 degrees
    gearState:        'UP',  // UP / TRANSIT / DOWN
    engineN1:         [75, 75], // percent (per engine)
    thrustReverse:    false,
    brakePressure:    0,     // psi
    brakeTemp:        [180, 180, 180, 180], // °C (4 main wheels)
    runwayOccupied:   false,
    runwayOccupancyTimer: 0, // seconds on active runway
    touchdownRate:    0,     // fpm at touchdown (negative = descent)
    touchdownG:       0,
    decelerationG:    0,

    // Wind
    windDirection: currentWinds.direction,
    windSpeed:     currentWinds.speed,
    crosswindComp: 0,
    headwindComp:  currentWinds.speed,

    // Scheduling
    scheduledArrival:   schedArr.toISOString(),
    actualArrival:      actualArr.toISOString(),
    scheduledDeparture: schedDep.toISOString(),
    actualDeparture:    null,

    // ATC log
    atcLog,
    atcClearance: null, // last clearance string

    // Phase history timestamps
    phaseTimestamps: { WAITING: new Date().toISOString() },
  };

  flights.set(id, flight);
  return flight;
}

/** Seed the store with a nice spread across phases */
function seedFlights() {
  const phases = ['WAITING', 'AT_STAND', 'TAXI_OUT', 'TAKEOFF'];
  phases.forEach((phase) => {
    const f = createNewFlight();
    f.phase = phase;
    f.phaseTimer = Math.random() * 5;
    applyInitialPositionForPhase(f, phase);
  });
}

function applyInitialPositionForPhase(f, phase) {
  switch(phase) {
    case 'WAITING':     f.position = { x: 50,  y: 200, z: 400 }; f.speed = 180; f.altitude = 8000; f.gearState = 'UP';   break;
    case 'APPROACH':    f.position = { x: 5,   y: 80,  z: 500 }; f.speed = 145; f.altitude = 4000; f.gearState = 'DOWN'; break;
    case 'LANDING':     f.position = { x: 0,   y: 5,   z: 50  }; f.speed = 120; f.altitude = 200;  f.gearState = 'DOWN'; break;
    case 'ROLL_OUT':    f.position = { x: 0,   y: 0,   z: -50 }; f.speed = 60;  f.altitude = 0;    f.gearState = 'DOWN'; break;
    case 'RUNWAY_EXIT': f.position = { x: 30,  y: 0,   z: -80 }; f.speed = 20;  f.altitude = 0;    f.gearState = 'DOWN'; break;
    case 'TAXI_IN':     f.position = { x: 60,  y: 0,   z: -50 }; f.speed = 12;  f.altitude = 0;    f.gearState = 'DOWN'; break;
    case 'AT_STAND':    f.position = { x: 100, y: 0,   z: 20  }; f.speed = 0;   f.altitude = 0;    f.gearState = 'DOWN'; break;
    case 'PUSHBACK':    f.position = { x: 95,  y: 0,   z: 30  }; f.speed = 5;   f.altitude = 0;    f.gearState = 'DOWN'; break;
    case 'TAXI_OUT':    f.position = { x: 70,  y: 0,   z: 10  }; f.speed = 12;  f.altitude = 0;    f.gearState = 'DOWN'; break;
    case 'LINE_UP':     f.position = { x: 10,  y: 0,   z: 20  }; f.speed = 8;   f.altitude = 0;    f.gearState = 'DOWN'; break;
    case 'TAKEOFF':     f.position = { x: 0,   y: 10,  z: 30  }; f.speed = 100; f.altitude = 500;  f.gearState = 'TRANSIT'; break;
  }
}

function getAll()    { return Array.from(flights.values()); }
function getById(id) { return flights.get(id) || null; }
function set(flight) { flights.set(flight.id, flight); }
function remove(id)  { flights.delete(id); }
function size()      { return flights.size; }

module.exports = { getAll, getById, set, remove, size, createNewFlight, seedFlights, getWinds };
