// engine.js — Main simulation loop
// Ticks the state machine for every flight, spawns new ones to maintain density,
// and removes flights that have completed their takeoff.

const dataStore = require('../store/dataStore');
const stateMachine = require('./stateMachine');

const TARGET_FLIGHT_COUNT = 4;  // Reduced density to prevent overcrowding
const TICK_INTERVAL_MS    = 50; // Internal simulation step (20 Hz)

let lastTickTime = Date.now();

function tick() {
  const now = Date.now();
  const dt  = (now - lastTickTime) / 1000; // seconds elapsed since last tick
  lastTickTime = now;

  // Evolve each active flight
  const allFlights = dataStore.getAll();
  for (const flight of allFlights) {
    const shouldRemove = stateMachine.tick(flight, dt);
    if (shouldRemove) {
      console.log(`[Engine] Flight ${flight.id} departed. Removing.`);
      dataStore.remove(flight.id);
    } else {
      dataStore.set(flight); // Write updated state back
    }
  }

  // Spawn new aircraft if we're below target density
  if (dataStore.size() < TARGET_FLIGHT_COUNT) {
    const newFlight = dataStore.createNewFlight();
    console.log(`[Engine] Spawning new flight: ${newFlight.id} on ${newFlight.runway}`);
  }
}

function start() {
  console.log('[Engine] Simulation engine starting…');
  // Seed with a nice spread of aircraft across all phases
  dataStore.seedFlights();
  // Start the simulation loop
  setInterval(tick, TICK_INTERVAL_MS);
  console.log(`[Engine] Running at ${1000 / TICK_INTERVAL_MS} Hz`);
}

module.exports = { start };
