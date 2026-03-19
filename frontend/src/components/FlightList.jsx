// FlightList.jsx — Premium flight tracking list
// Shows all active aircraft with cinematic badges and real-time metrics.

import React from 'react';
import { Plane, MapPin, Gauge, Activity } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';

function formatPhase(phase) {
  return phase.replace(/_/g, ' ');
}

function PhaseBadge({ phase }) {
  return (
    <span className={`phase-badge phase-${phase}`}>
      {formatPhase(phase)}
    </span>
  );
}

function FlightRow({ flight, isSelected, onClick }) {
  return (
    <div
      className={`flight-row ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
    >
      <div className="flight-row__icon-box">
        <Plane size={16} style={{ transform: `rotate(${flight.heading - 45}deg)` }} />
      </div>
      
      <div style={{ paddingLeft: '12px' }}>
        <div className="flight-row__callsign">{flight.id}</div>
        <div className="flight-row__airline">{flight.airline}</div>
        <div style={{ marginTop: '6px' }}>
          <PhaseBadge phase={flight.phase} />
        </div>
      </div>

      <div className="flight-row__meta" style={{ textAlign: 'right' }}>
        <div className="flight-row__stand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          <MapPin size={10} color="var(--text-muted)" />
          {flight.stand || '—'}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--accent-amber)', marginTop: '6px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          <Gauge size={10} />
          {Math.round(flight.speed)}kt
        </div>
      </div>
    </div>
  );
}

export function FlightList() {
  const flights = useFlightStore(s => s.flights);
  const selectedFlightId = useFlightStore(s => s.selectedFlightId);
  const selectFlight = useFlightStore(s => s.selectFlight);
  const connected = useFlightStore(s => s.connected);

  const PHASE_SORT_ORDER = [
    'WAITING', 'APPROACH', 'LANDING', 'ROLL_OUT', 'RUNWAY_EXIT',
    'TAXI_IN', 'AT_STAND', 'PUSHBACK', 'TAXI_OUT', 'LINE_UP', 'TAKEOFF',
  ];
  
  const sorted = [...flights].sort(
    (a, b) => PHASE_SORT_ORDER.indexOf(a.phase) - PHASE_SORT_ORDER.indexOf(b.phase)
  );

  return (
    <div className="flight-list">
      <div className="flight-list__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={12} color={connected ? 'var(--accent-green)' : 'var(--accent-red)'} />
          <span>{connected ? 'LIVE FEED ACTIVE' : 'SYSTEM OFFLINE'}</span>
        </div>
        <div>
          {flights.length} TRK
        </div>
      </div>

      {sorted.map(flight => (
        <FlightRow
          key={flight.id}
          flight={flight}
          isSelected={flight.id === selectedFlightId}
          onClick={() => selectFlight(flight.id === selectedFlightId ? null : flight.id)}
        />
      ))}

      {flights.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', opacity: 0.5 }}>
          {connected ? 'WAVEFRONT CLEAR · NO TARGETS' : 'INITIALISING RADAR…'}
        </div>
      )}
    </div>
  );
}
