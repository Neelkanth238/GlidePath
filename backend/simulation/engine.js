// engine.js — Main simulation loop
// Ticks the state machine for every flight, spawns new ones to maintain density.

const dataStore    = require('../store/dataStore');
const stateMachine = require('./stateMachine');

const TARGET_FLIGHT_COUNT = 5;
const TICK_INTERVAL_MS    = 50; // 20 Hz

let lastTickTime = Date.now();

function tick() {
  const now = Date.now();
  const dt  = (now - lastTickTime) / 1000;
  lastTickTime = now;

  // Push current wind data to state machine (avoids circular dep)
  stateMachine.setCurrentWinds(dataStore.getWinds());

  const allFlights = dataStore.getAll();
  for (const flight of allFlights) {
    const shouldRemove = stateMachine.tick(flight, dt);
    if (shouldRemove) {
      console.log(`[Engine] Flight ${flight.id} departed. Removing.`);
      dataStore.remove(flight.id);
    } else {
      dataStore.set(flight);
    }
  }

  // Spawn new aircraft if below target
  if (dataStore.size() < TARGET_FLIGHT_COUNT) {
    const newFlight = dataStore.createNewFlight();
    console.log(`[Engine] Spawning: ${newFlight.id} (${newFlight.aircraftType}) from ${newFlight.origin}`);
  }
}

function start() {
  console.log('[Engine] Simulation engine starting…');
  dataStore.seedFlights();
  setInterval(tick, TICK_INTERVAL_MS);
  console.log(`[Engine] Running at ${1000 / TICK_INTERVAL_MS} Hz`);
}

module.exports = { start };
