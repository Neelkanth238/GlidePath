// ATCBubbles.jsx — Bubble-style ATC Clearance Notifications
// Flights waiting for clearance pop up as floating bubbles on the right edge.
// Click a bubble to expand → full detail + clearance action.

import React, { useState, useEffect, useRef } from 'react';
import { Navigation, Plane, Radio, Wind, X, ChevronRight, RotateCw } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return '—'; }
}

const PHASE_META = {
  WAITING:   { label: 'LANDING REQ',  color: '#f59e0b', icon: Navigation, action: 'approve',         btnLabel: 'APPROVE LANDING', btnColor: '#4ade80' },
  AT_STAND:  { label: 'TAXI CLEARANCE', color: '#06b6d4', icon: Radio,  action: 'approve-taxi',   btnLabel: 'APPROVE TAXI',    btnColor: '#06b6d4' },
  TAXI_OUT:  { label: 'TAKEOFF REQ',  color: '#3b82f6', icon: Plane,          action: 'approve-takeoff', btnLabel: 'APPROVE TAKEOFF', btnColor: '#3b82f6' },
};

function SpecItem({ label, value, unit, alert }) {
  return (
    <div className="spec-item">
      <span className="spec-label">{label}</span>
      <div className="spec-value" style={{ color: alert ? 'var(--accent-red)' : undefined }}>
        {value} {unit && <span className="spec-unit">{unit}</span>}
      </div>
    </div>
  );
}

function PhaseNode({ label, active }) {
  return (
    <div className={`phase-node ${active ? 'active' : ''}`}>
      <span className="node-label-pro">{label}</span>
    </div>
  );
}

const WEIGHT_COLORS = { HEAVY: '#ef4444', MEDIUM: '#f59e0b', LIGHT: '#10b981' };

function FreeRunwaySelect({ value, onChange, color, flightId }) {
  const flights = useFlightStore(s => s.flights);
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

  useEffect(() => {
    if (!freeRunways.includes(value) && freeRunways.length > 0) onChange(freeRunways[0]);
  }, [freeRunways.join(','), value]);

  if (freeRunways.length === 0)
    return <span className="bubble-no-rwy">NO RWY FREE</span>;

  return (
    <div className="rwy-select-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <select
        value={value}
        onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
        onClick={e => e.stopPropagation()}
        className="custom-select"
        style={{ width: '100%' }}
      >
        {freeRunways.map(r => <option key={r} value={r} style={{ background: '#111', color: '#fff' }}>RWY {r}</option>)}
      </select>
      <ChevronRight size={10} style={{ position: 'absolute', right: 12, transform: 'rotate(90deg)', pointerEvents: 'none', opacity: 0.5 }} />
    </div>
  );
}

// ── Single Bubble ─────────────────────────────────────────────────────────────

function ATCBubble({ flight, index, openId, setOpenId }) {
  // ── ALL hooks must be called unconditionally (Rules of Hooks) ──────────────
  // The meta guard must come AFTER every hook, never before.
  const [runway, setRunway]   = useState(flight.runway || '27R');
  const [loading, setLoading] = useState(false);

  // Sync runway state when flight changes
  useEffect(() => {
    if (flight.runway && flight.runway !== runway) setRunway(flight.runway);
  }, [flight.runway]); // eslint-disable-line

  // Reset loading spinner on phase change
  useEffect(() => { setLoading(false); }, [flight.id, flight.phase]);

  // ── NOW it's safe to bail out after all hooks ran ───────────────────────────
  const meta = PHASE_META[flight.phase];
  if (!meta) return null;

  const isOpen     = openId === flight.id;
  const isApproved = flight.approvedForLanding || flight.approvedForTaxi || flight.approvedForTakeoff;
  const wc         = flight.weightClass || 'MEDIUM';
  const wcColor    = WEIGHT_COLORS[wc] || '#6b7280';
  const Icon       = meta.icon;

  const handleApprove = async e => {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/flights/${flight.id}/${meta.action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runway }),
      });
      if (res.ok) {
        // Success: the backend will push the updated flight status via WebSocket
      } else {
        const d = await res.json();
        alert(d.error || 'Approval failed');
      }
    } catch { alert('Connection error'); }
    finally { setLoading(false); }
  };

  return (
    <div className={`atc-bubble-wrap ${isOpen ? 'open' : ''}`}>
      {/* ── DESIGNER PILL (Collapsed) ───────────────────── */}
      <div
        className={`atc-bubble-pill ${isOpen ? 'hidden' : ''}`}
        style={{ '--meta-color': meta.color }}
        onClick={() => setOpenId(flight.id)}
      >
        <div className="bubble-airline-dot" style={{
          background: `${flight.airlineColor || '#003580'}22`,
          color: flight.airlineColor || '#fff',
          borderColor: `${flight.airlineColor || '#003580'}44`,
          border: '1px solid'
        }}>
          {flight.airlineCode || 'AAL'}
        </div>

        <div className="bubble-pill-info">
          <div className="bubble-callsign">{flight.id}</div>
          <div className="bubble-type-label">{meta.label}</div>
        </div>

        <div className="bubble-status-icon-box">
          <Icon size={18} strokeWidth={2.5} />
        </div>
      </div>

      {/* ── AWARD-WINNING DESIGNER CARD (Expanded) ────────── */}
      <div className={`atc-bubble-card ${isOpen ? 'visible' : ''}`} style={{ '--meta-color': meta.color }}>
        
        {/* Left Branding Sidebar */}
        <div className="bubble-card-sidebar">
          <div className="sidebar-icon-box">
             <Icon size={18} strokeWidth={2.5} />
          </div>
          <div className="sidebar-airline-badge">
            {flight.airlineName || 'OPERATOR'} · {flight.airlineCode || 'AAL'}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bubble-card-content">
          <div className="bubble-card-header-pro">
            <div className="title-group">
              <div className="atc-main-callsign">{flight.id}</div>
              <div className="atc-sub-info">
                {flight.aircraftType || 'A320'} · {wc} CLASS · STA {fmtTime(flight.scheduledArrival)}
              </div>
            </div>
            <X size={18} className="close-action" onClick={() => setOpenId(null)} />
          </div>

          <div className="specs-sheet">
            <SpecItem label="ALTITUDE" value={Math.round(flight.altitude || 0)} unit="FT" />
            <SpecItem label="AIRSPEED" value={Math.round(flight.speed)} unit="KT" />
            <SpecItem label="SQUAWK" value={flight.squawk || '7000'} />
            <SpecItem label="FUEL" value={Math.round((flight.fuelKg || 0)/1000).toFixed(1)} unit="T" />
            <SpecItem label="WIND" value={`${Math.round(flight.windDirection || 270)}°/${Math.round(flight.windSpeed || 12)}`} />
            <SpecItem 
              label="CROSSWIND" 
              value={Math.abs(flight.crosswindComp || 0).toFixed(0)} 
              unit="KT"
              alert={Math.abs(flight.crosswindComp || 0) > 15}
            />
          </div>

          <div className="atc-phase-timeline">
            <PhaseNode label="ARRIVAL" active={flight.phase === 'WAITING'} />
            <PhaseNode label="APPROACH" active={flight.approvedForLanding} />
            <PhaseNode label="LANDING" active={flight.phase === 'LANDING'} />
          </div>

          <div className="atc-control-panel">
            <div className="control-row">
              <div className="input-field">
                <label>RUNWAY ASSIGNMENT</label>
                <FreeRunwaySelect
                  flightId={flight.id}
                  value={runway}
                  onChange={setRunway}
                  color={meta.color}
                />
              </div>
              <button
                className={`action-button-pro ${isApproved ? 'approved' : ''}`}
                style={{ '--meta-color': meta.color }}
                onClick={handleApprove}
                disabled={loading || isApproved}
              >
                {loading ? (
                  <RotateCw size={18} className="spin" />
                ) : isApproved ? (
                  <>
                    <RotateCw size={16} className="spin" style={{ opacity: 0.7 }} />
                    <span>PROCESS ACTIVE</span>
                  </>
                ) : (
                  <>
                    <Navigation size={16} fill="currentColor" />
                    <span>{meta.btnLabel}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Container ────────────────────────────────────────────────────────────

export function ATCBubbles() {
  const flights = useFlightStore(s => s.flights);
  const [openId, setOpenId] = useState(null);

  const activeBubbles = flights.filter(f => {
    // PENDING: Waiting for player action
    const isPendingLanding = f.phase === 'WAITING' && !f.approvedForLanding;
    const isPendingTaxi    = f.phase === 'AT_STAND' && !f.approvedForTaxi;
    const isPendingTakeoff = f.phase === 'TAXI_OUT' && !f.approvedForTakeoff;

    if (isPendingLanding || isPendingTaxi || isPendingTakeoff) return true;

    // ACTIVE: Approved but still in progress
    const isActiveApproach = f.approvedForLanding && ['WAITING', 'APPROACH', 'LANDING'].includes(f.phase);
    const isActiveTaxi     = f.approvedForTaxi && f.phase === 'TAXI_OUT' && f.progress < 1;
    const isActiveDeparture = f.approvedForTakeoff && ['TAXI_OUT', 'LINE_UP', 'TAKEOFF'].includes(f.phase);

    return isActiveApproach || isActiveTaxi || isActiveDeparture;
  });

  // Close open bubble if its flight disappears from our active list
  useEffect(() => {
    if (openId && !activeBubbles.find(r => r.id === openId)) setOpenId(null);
  }, [activeBubbles.length]);

  if (activeBubbles.length === 0) return null;

  return (
    <div className="atc-bubbles-container">
      {activeBubbles.map((flight, i) => (
        <ATCBubble
          key={flight.id}
          flight={flight}
          index={i}
          openId={openId}
          setOpenId={setOpenId}
        />
      ))}

      {/* Badge showing total pending count (not active ones) */}
      {!openId && activeBubbles.filter(f => !f.approvedForLanding && !f.approvedForTaxi && !f.approvedForTakeoff).length > 1 && (
        <div className="atc-bubbles-count-badge">
          {activeBubbles.filter(f => !f.approvedForLanding && !f.approvedForTaxi && !f.approvedForTakeoff).length} PENDING
        </div>
      )}
    </div>
  );
}
