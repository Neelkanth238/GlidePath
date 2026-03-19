// server.js — RunwayDeck 3D Backend
// Express REST API + WebSocket server for real-time flight data streaming
//
// Start with: node server.js
// REST:  GET http://localhost:8080/flights
//        GET http://localhost:8080/flights/:id
// WS:    ws://localhost:8080

const express = require('express');
const http    = require('http');
const { WebSocketServer } = require('ws');
const cors    = require('cors');

const dataStore    = require('./store/dataStore');
const engine       = require('./simulation/engine');

const PORT = 8080;
const WS_BROADCAST_INTERVAL_MS = 50; // 20 Hz broadcast to clients

// ─────────────────────────────────────────────────────────────────────────────
// HTTP setup
// ─────────────────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors()); // Allow the React dev server (port 5173) to call this API
app.use(express.json());

// GET /flights — list all active aircraft
app.get('/flights', (req, res) => {
  res.json(dataStore.getAll());
});

// GET /flights/:id — single aircraft detail
app.get('/flights/:id', (req, res) => {
  const flight = dataStore.getById(req.params.id);
  if (!flight) {
    return res.status(404).json({ error: `Flight ${req.params.id} not found` });
  }
  res.json(flight);
});

// POST /flights/:id/approve — clear aircraft for landing
app.post('/flights/:id/approve', (req, res) => {
  const flight = dataStore.getById(req.params.id);
  if (!flight) {
    return res.status(404).json({ error: `Flight ${req.params.id} not found` });
  }
  flight.approvedForLanding = true;
  res.json({ success: true, flight });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', flights: dataStore.size(), time: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket setup
// ─────────────────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log(`[WS] New client connected from ${req.socket.remoteAddress}`);

  // Send the full snapshot immediately so the client doesn't wait for next broadcast
  const initPayload = JSON.stringify({ type: 'INIT', data: dataStore.getAll() });
  ws.send(initPayload);

  ws.on('close', () => console.log('[WS] Client disconnected'));
  ws.on('error', (err) => console.error('[WS] Error:', err.message));
});

/**
 * Broadcast current state to ALL connected clients every 250ms.
 * Only sends if there are clients connected (saves CPU).
 */
setInterval(() => {
  if (wss.clients.size === 0) return;

  const payload = JSON.stringify({ type: 'UPDATE', data: dataStore.getAll() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* WebSocket.OPEN */) {
      client.send(payload);
    }
  });
}, WS_BROADCAST_INTERVAL_MS);

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
engine.start(); // Kick off the simulation loop + seed initial flights

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║     RunwayDeck 3D Backend  🛫            ║
  ╠══════════════════════════════════════════╣
  ║  REST:  http://localhost:${PORT}/flights     ║
  ║  WS:    ws://localhost:${PORT}               ║
  ║  Health:http://localhost:${PORT}/health      ║
  ╚══════════════════════════════════════════╝
  `);
});
