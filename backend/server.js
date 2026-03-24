// server.js — GlidePath 3D Backend
// Express REST API + WebSocket server for real-time flight data streaming

const express = require('express');
const http    = require('http');
const { WebSocketServer } = require('ws');
const cors    = require('cors');

const dataStore    = require('./store/dataStore');
const engine       = require('./simulation/engine');

const PORT = 8080;
const WS_BROADCAST_INTERVAL_MS = 50; // 20 Hz

const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// ── REST ──────────────────────────────────────────────────────────────────────

// GET /flights
app.get('/flights', (req, res) => {
  res.json(dataStore.getAll());
});

// GET /flights/:id
app.get('/flights/:id', (req, res) => {
  const flight = dataStore.getById(req.params.id);
  if (!flight) return res.status(404).json({ error: `Flight ${req.params.id} not found` });
  res.json(flight);
});

// POST /flights/:id/approve  — ATC clears aircraft for landing
app.post('/flights/:id/approve', (req, res) => {
  const flight = dataStore.getById(req.params.id);
  if (!flight) return res.status(404).json({ error: `Flight ${req.params.id} not found` });

  if (req.body.runway) flight.runway = req.body.runway;

  const occupied = dataStore.getAll().find(f => f.runway === flight.runway && f.runwayOccupied && f.id !== flight.id);
  if (occupied) return res.status(400).json({ error: `Runway ${flight.runway} is currently occupied by ${occupied.id}.` });

  flight.approvedForLanding = true;

  // Log pilot readback
  if (!flight.atcLog) flight.atcLog = [];
  flight.atcLog.push({
    time: new Date().toISOString(),
    from: 'PILOT',
    msg: `Cleared ILS approach runway ${flight.runway}, ${flight.id}.`,
  });
  flight.atcLog.push({
    time: new Date().toISOString(),
    from: 'ATC',
    msg: `${flight.id}, wind ${Math.round(flight.windDirection || 270)}° at ${Math.round(flight.windSpeed || 12)} knots, runway ${flight.runway} cleared to land, QNH 1013.`,
  });
  if (flight.atcLog.length > 20) flight.atcLog = flight.atcLog.slice(-20);
  flight.atcClearance = `RUNWAY ${flight.runway} - ILS APPROACH CLEARED`;

  dataStore.set(flight);
  console.log(`[ATC] ${flight.id} cleared for ILS runway ${flight.runway}`);
  res.json({ success: true, flight });
});

// POST /flights/:id/approve-taxi  — ATC clears aircraft for taxi
app.post('/flights/:id/approve-taxi', (req, res) => {
  const flight = dataStore.getById(req.params.id);
  if (!flight) return res.status(404).json({ error: `Flight ${req.params.id} not found` });

  if (req.body.runway) flight.runway = req.body.runway;
  flight.approvedForTaxi = true;

  if (!flight.atcLog) flight.atcLog = [];
  flight.atcLog.push({
    time: new Date().toISOString(),
    from: 'ATC',
    msg: `${flight.id}, cleared to taxi via active taxiways.`,
  });
  if (flight.atcLog.length > 20) flight.atcLog = flight.atcLog.slice(-20);
  flight.atcClearance = `CLEARED TO TAXI`;

  dataStore.set(flight);
  console.log(`[ATC] ${flight.id} cleared for taxi`);
  res.json({ success: true, flight });
});

// POST /flights/:id/approve-takeoff  — ATC clears aircraft for takeoff
app.post('/flights/:id/approve-takeoff', (req, res) => {
  const flight = dataStore.getById(req.params.id);
  if (!flight) return res.status(404).json({ error: `Flight ${req.params.id} not found` });

  if (req.body.runway) flight.runway = req.body.runway;

  const occupied = dataStore.getAll().find(f => f.runway === flight.runway && f.runwayOccupied && f.id !== flight.id);
  if (occupied) return res.status(400).json({ error: `Runway ${flight.runway} is currently occupied by ${occupied.id}.` });

  flight.approvedForTakeoff = true;

  if (!flight.atcLog) flight.atcLog = [];
  flight.atcLog.push({
    time: new Date().toISOString(),
    from: 'ATC',
    msg: `${flight.id}, wind ${Math.round(flight.windDirection || 270)}° at ${Math.round(flight.windSpeed || 12)} knots, runway ${flight.runway} cleared for takeoff.`,
  });
  if (flight.atcLog.length > 20) flight.atcLog = flight.atcLog.slice(-20);
  flight.atcClearance = `CLEARED FOR TAKEOFF`;

  dataStore.set(flight);
  console.log(`[ATC] ${flight.id} cleared for takeoff`);
  res.json({ success: true, flight });
});

// POST /flights/:id/atc  — Generic ATC message injection
app.post('/flights/:id/atc', (req, res) => {
  const flight = dataStore.getById(req.params.id);
  if (!flight) return res.status(404).json({ error: `Flight ${req.params.id} not found` });

  const { from, msg } = req.body;
  if (!msg) return res.status(400).json({ error: 'msg required' });

  if (!flight.atcLog) flight.atcLog = [];
  flight.atcLog.push({ time: new Date().toISOString(), from: from || 'ATC', msg });
  if (flight.atcLog.length > 20) flight.atcLog = flight.atcLog.slice(-20);
  flight.atcClearance = msg;

  dataStore.set(flight);
  res.json({ success: true });
});

// GET /winds — Current wind data
app.get('/winds', (req, res) => {
  res.json(dataStore.getWinds());
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', flights: dataStore.size(), time: new Date().toISOString() });
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);
  ws.send(JSON.stringify({ type: 'INIT', data: dataStore.getAll() }));

  ws.on('close', () => console.log('[WS] Client disconnected'));
  ws.on('error', (err) => console.error('[WS] Error:', err.message));
});

setInterval(() => {
  if (wss.clients.size === 0) return;
  const payload = JSON.stringify({ type: 'UPDATE', data: dataStore.getAll() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}, WS_BROADCAST_INTERVAL_MS);

// ── Boot ──────────────────────────────────────────────────────────────────────
engine.start();

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║     GlidePath 3D Backend  🛫             ║
  ╠══════════════════════════════════════════╣
  ║  REST:  http://localhost:${PORT}/flights     ║
  ║  WS:    ws://localhost:${PORT}               ║
  ║  Health:http://localhost:${PORT}/health      ║
  ╚══════════════════════════════════════════╝
  `);
});
