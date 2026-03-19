// useFlightStore.js — Zustand global state store
// All three panels (FlightList, Map2D, Scene3D) subscribe to this single store.
// No prop-drilling needed — updates flow automatically everywhere.

import { create } from 'zustand';

export const useFlightStore = create((set) => ({
  // ── Data ───────────────────────────────────────────────────────────────────
  flights: [],
  connected: false,

  // ── Selection ──────────────────────────────────────────────────────────────
  selectedFlightId: null,

  // ── Camera ─────────────────────────────────────────────────────────────────
  // 'TOWER', 'FOLLOW', 'RUNWAY'
  cameraMode: 'TOWER',

  // ── Actions ────────────────────────────────────────────────────────────────
  setFlights:    (flights)       => set({ flights }),
  setConnected:  (connected)     => set({ connected }),
  selectFlight:  (id)            => set({ selectedFlightId: id }),
  setCameraMode: (mode)          => set({ cameraMode: mode }),

  // Derived helper — used by CameraRig to get the focused aircraft object
  getSelected: (state) => state.flights.find(f => f.id === state.selectedFlightId),
}));
