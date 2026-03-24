// useFlightStore.js — Zustand global state store
// All three panels (FlightList, Map2D, Scene3D) subscribe to this single store.
// No prop-drilling needed — updates flow automatically everywhere.

import { create } from 'zustand';

export const useFlightStore = create((set, get) => ({
  // ── Data ───────────────────────────────────────────────────────────────────
  flights: [],
  connected: false,

  // ── Selection ──────────────────────────────────────────────────────────────
  selectedFlightId: null,

  // ── Camera ─────────────────────────────────────────────────────────────────
  cameraMode: 'TOWER',

  // ── Actions ────────────────────────────────────────────────────────────────
  /**
   * Smart update: only updates flights whose data actually changed.
   * This prevents re-renders of Aircraft components when their data is unchanged.
   * Creates new array reference only when needed.
   */
  setFlights: (incoming) => {
    const current = get().flights;
    const currentMap = new Map(current.map(f => [f.id, f]));
    const incomingMap = new Map(incoming.map(f => [f.id, f]));

    let changed = current.length !== incoming.length;
    const next = incoming.map(f => {
      const prev = currentMap.get(f.id);
      if (!prev) { changed = true; return f; }
      // Deep-compare only the fields that Aircraft.jsx actually reads
      if (
        prev.position.x !== f.position.x ||
        prev.position.y !== f.position.y ||
        prev.position.z !== f.position.z ||
        prev.phase      !== f.phase      ||
        prev.progress   !== f.progress   ||
        prev.heading    !== f.heading
      ) {
        changed = true;
        return f;
      }
      return prev; // Return same reference — no re-render!
    });

    if (changed) set({ flights: next });
  },

  setConnected:  (connected) => set({ connected }),
  selectFlight:  (id)        => set({ selectedFlightId: id }),
  setCameraMode: (mode)      => set({ cameraMode: mode }),

  // Derived helper — used by CameraRig to get the focused aircraft object
  getSelected: (state) => state.flights.find(f => f.id === state.selectedFlightId),
}));
