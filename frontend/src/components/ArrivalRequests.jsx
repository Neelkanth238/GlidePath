// ArrivalRequests.jsx — Real-world ATC Arrival Management Panel
// Shows inbound flights awaiting ILS approach clearance with full telemetry.

import React from 'react';
import { PlaneLanding, Bell, Radio, Wind, Plane } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function WeightBadge({ wc }) {
  const colors = { HEAVY: '#ef4444', MEDIUM: '#f59e0b', LIGHT: '#10b981' };
  return (
    <span style={{
      fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
      background: `${colors[wc] || '#6b7280'}22`,
      color: colors[wc] || '#6b7280',
      border: `1px solid ${colors[wc] || '#6b7280'}44`,
      fontFamily: 'var(--font-mono)',
      letterSpacing: 1,
    }}>{wc || 'MEDIUM'}</span>
  );
}

function FreeRunwaySelect({ value, onChange, color = 'var(--accent-amber)', flightId }) {
  const flights = useFlightStore(s => s.flights);

  // A runway is "in use" if any OTHER flight is using it in an active phase
  const occupiedRunways = new Set(
    flights
      .filter(f => f.id !== flightId)
      .filter(f => {
        const activePhases = ['APPROACH', 'LANDING', 'ROLL_OUT', 'LINE_UP', 'TAKEOFF'];
        if (activePhases.includes(f.phase)) return true;
        if (f.phase === 'WAITING' && f.approvedForLanding) return true;
        if (f.phase === 'TAXI_OUT' && f.approvedForTakeoff) return true;
        return false;
      })
      .map(f => f.runway)
  );
  const ALL_RUNWAYS = ['27L', '27C', '27R', '09L', '09R'];
  const freeRunways = ALL_RUNWAYS.filter(r => !occupiedRunways.has(r));

  React.useEffect(() => {
    if (!freeRunways.includes(value) && freeRunways.length > 0) {
      onChange(freeRunways[0]);
    }
  }, [freeRunways.join(','), value, onChange]);

  if (freeRunways.length === 0) {
    return (
      <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '2px 4px', border: '1px solid #ef4444',
          color: '#ef4444', background: 'transparent',
          fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '9px'
      }}>NO RWY FREE</div>
    );
  }

  return (
    <select
      value={value}
      onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
      onClick={e => e.stopPropagation()}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '3px 6px',
        border: `1px solid ${color}`, color: '#000', background: color,
        fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '9px',
        cursor: 'pointer', outline: 'none'
      }}
    >
      {freeRunways.map(r => <option key={r} value={r}>RWY {r}</option>)}
    </select>
  );
}

function ArrivalCard({ flight, onApprove, buttonText = "APPROVE" }) {
  const [expanded, setExpanded] = React.useState(false);
  const [selectedRunway, setSelectedRunway] = React.useState(flight.runway || '27R');

  React.useEffect(() => {
    if (flight.runway) setSelectedRunway(flight.runway);
  }, [flight.runway]);

  const headwind = (flight.headwindComp || 0).toFixed(0);
  const crosswind = Math.abs(flight.crosswindComp || 0).toFixed(0);
  const xwWarn = Math.abs(flight.crosswindComp || 0) > 15;

  return (
    <div
      className="arrival-card"
      style={{
        marginBottom: 8,
        border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.3)',
      }}
    >
      {/* Main row */}
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', gap: 10 }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Airline dot */}
        <div style={{
          width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: `${flight.airlineColor || '#003580'}33`,
          border: `1px solid ${flight.airlineColor || '#003580'}66`,
          fontSize: 9, fontWeight: 800, color: flight.airlineColor || '#fff',
          fontFamily: 'var(--font-mono)',
        }}>
          {flight.airlineCode}
        </div>

        {/* Flight info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: 1 }}>
              {flight.id}
            </span>
            <WeightBadge wc={flight.weightClass} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
            {flight.origin || 'UNKN'} → EGLL · {flight.aircraftType || 'A320'} · STA {fmtTime(flight.scheduledArrival)}
          </div>
          <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {Math.round(flight.altitude || 8000)}ft · {Math.round(flight.speed)}kt · SQK {flight.squawk || '7000'}
          </div>
        </div>

        {/* Approve */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          { (buttonText === 'TAXI' || buttonText === 'LANDING') && (
            <FreeRunwaySelect flightId={flight.id} value={selectedRunway} onChange={setSelectedRunway} color="var(--accent-amber)" />
          )}
          <button
            className="approve-btn"
            onClick={(e) => { e.stopPropagation(); onApprove(flight.id, selectedRunway); }}
            style={{ padding: '6px 10px', fontSize: 9, letterSpacing: 1.5 }}
          >
            {buttonText}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '0 12px 12px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          {/* Wind / ILS info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
            <div className="ar-detail-item">
              <label>RUNWAY</label>
              <span>{flight.runway || '27R'}</span>
            </div>
            <div className="ar-detail-item">
              <label>ILS FREQ</label>
              <span>{flight.ilsFrequency || '—'}</span>
            </div>
            <div className="ar-detail-item">
              <label>HEADWIND</label>
              <span>{headwind} KT</span>
            </div>
            <div className="ar-detail-item" style={{ color: xwWarn ? '#ef4444' : undefined }}>
              <label style={{ color: xwWarn ? '#ef4444' : undefined }}>CROSSWIND</label>
              <span>{crosswind} KT {xwWarn ? '⚠' : ''}</span>
            </div>
            <div className="ar-detail-item">
              <label>VREF</label>
              <span>{flight.vref || 140} KT</span>
            </div>
            <div className="ar-detail-item">
              <label>FUEL</label>
              <span>{Math.round((flight.fuelKg || 0) / 1000).toFixed(1)} t</span>
            </div>
            <div className="ar-detail-item">
              <label>GROSS WT</label>
              <span>{Math.round((flight.grossWeightKg || 0) / 1000).toFixed(0)} t</span>
            </div>
            <div className="ar-detail-item">
              <label>GLIDESLOPE</label>
              <span>{(flight.glideslopeAngle || 3).toFixed(1)}°</span>
            </div>
          </div>

          {/* Last ATC */}
          {flight.atcClearance && (
            <div style={{
              marginTop: 8, padding: '6px 8px', borderRadius: 4,
              background: 'rgba(6,182,212,0.08)',
              border: '1px solid rgba(6,182,212,0.2)',
              fontSize: 9, color: '#06b6d4', fontFamily: 'var(--font-mono)',
              lineHeight: 1.5,
            }}>
              <Radio size={8} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {flight.atcClearance}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ArrivalRequests() {
  const flights     = useFlightStore(s => s.flights);
  const arrivals    = flights.filter(f => f.phase === 'WAITING' && !f.approvedForLanding);
  const taxiReqs    = flights.filter(f => f.phase === 'AT_STAND' && !f.approvedForTaxi);
  const takeoffReqs = flights.filter(f => f.phase === 'TAXI_OUT' && !f.approvedForTakeoff && f.progress >= 1);
  const inApproach  = flights.filter(f => ['APPROACH', 'LANDING', 'ROLL_OUT'].includes(f.phase));

  const totalReqs = arrivals.length + taxiReqs.length + takeoffReqs.length;

  const handleApprove = async (id, type = 'approve', runway) => {
    try {
      const res = await fetch(`http://localhost:8080/flights/${id}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runway })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Approval failed');
      }
    } catch (err) {
      console.error('Approval failed', err);
    }
  };

  return (
    <div className="arrival-requests">
      {/* Header */}
      <div className="panel-header" style={{ marginBottom: 12 }}>
        <Bell size={14} />
        <h3>ATC MANAGEMENT</h3>
        <span className="badge">{totalReqs}</span>
      </div>

      {/* Active on approach / runway summary */}
      {inApproach.length > 0 && (
        <div style={{
          marginBottom: 10, padding: '6px 8px', borderRadius: 6,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          fontSize: 9, fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ color: '#10b981', marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>
            ● ACTIVE — RUNWAY IN USE
          </div>
          {inApproach.map(f => (
            <div key={f.id} style={{ color: 'var(--text-muted)', marginTop: 2 }}>
              {f.id} · {f.phase.replace(/_/g, ' ')} · {Math.round(f.speed)}KT · {Math.round(f.altitude || 0)}ft
            </div>
          ))}
        </div>
      )}

      {/* Pending arrivals */}
      {arrivals.length > 0 && (
        <div className="arrival-list" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 8, fontWeight: 700 }}>PENDING ARRIVALS</div>
          {arrivals.map(flight => (
            <ArrivalCard key={flight.id} flight={flight} onApprove={(id, rw) => handleApprove(id, 'approve', rw)} buttonText="LANDING" />
          ))}
        </div>
      )}

      {/* Pending Taxi */}
      {taxiReqs.length > 0 && (
        <div className="arrival-list" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#06b6d4', marginBottom: 8, fontWeight: 700 }}>TAXI CLEARANCE</div>
          {taxiReqs.map(flight => (
            <ArrivalCard key={flight.id} flight={flight} onApprove={(id, rw) => handleApprove(id, 'approve-taxi', rw)} buttonText="TAXI" />
          ))}
        </div>
      )}

      {/* Pending Takeoff */}
      {takeoffReqs.length > 0 && (
        <div className="arrival-list" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#3b82f6', marginBottom: 8, fontWeight: 700 }}>TAKEOFF CLEARANCE</div>
          {takeoffReqs.map(flight => (
            <ArrivalCard key={flight.id} flight={flight} onApprove={(id, rw) => handleApprove(id, 'approve-takeoff', rw)} buttonText="TAKEOFF" />
          ))}
        </div>
      )}

      {totalReqs === 0 && (
        <div style={{ padding: '24px 20px', textAlign: 'center', opacity: 0.4, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          NO PENDING ATC REQUESTS
        </div>
      )}
    </div>
  );
}
