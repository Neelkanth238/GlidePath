// WebSocketManager.jsx — Invisible logic component
// Manages the WebSocket lifecycle and feeds data into the Zustand store.
// Placed once at the root — no UI, just plumbing.

import { useEffect, useRef } from 'react';
import { useFlightStore } from '../store/useFlightStore';

const WS_URL = 'ws://localhost:8080';
const RECONNECT_DELAY_MS = 3000;

export function WebSocketManager() {
  const setFlights   = useFlightStore(s => s.setFlights);
  const setConnected = useFlightStore(s => s.setConnected);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  function connect() {
    console.log('[WS] Connecting to', WS_URL);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected ✓');
      setConnected(true);
      clearTimeout(reconnectTimer.current);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Both INIT (first connection) and UPDATE (periodic) carry the full flights array.
        if (msg.type === 'INIT' || msg.type === 'UPDATE') {
          setFlights(msg.data);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.warn('[WS] Disconnected. Retrying in', RECONNECT_DELAY_MS, 'ms…');
      setConnected(false);
      // Auto-reconnect after a delay
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.close();
    };
  }

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []); // Only runs once on mount

  return null; // This component renders nothing
}
