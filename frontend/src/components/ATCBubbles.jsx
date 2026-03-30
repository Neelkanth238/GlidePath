// ATCBubbles.jsx — Bubble-style ATC Clearance Notifications
// Flights waiting for clearance pop up as floating bubbles on the right edge.
// Click a bubble to expand → full detail + clearance action.

import React, { useState, useEffect, useRef } from 'react';
import { PlaneLanding, TowerControl, Plane, Navigation, Radio, Wind, X, ChevronRight, Loader } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const PHASE_META = {
  WAITING:   { label: 'LANDING REQ',  color: '#f59e0b', icon: PlaneLanding, action: 'approve',         btnLabel: 'APPROVE LANDING', btnColor: '#4ade80' },
  AT_STAND:  { label: 'TAXI CLEARANCE', color: '#06b6d4', icon: TowerControl,  action: 'approve-taxi',   btnLabel: 'APPROVE TAXI',    btnColor: '#06b6d4' },
  TAXI_OUT:  { label: 'TAKEOFF REQ',  color: '#3b82f6', icon: Plane,          action: 'approve-takeoff', btnLabel: 'APPROVE TAKEOFF', btnColor: '#3b82f6' },
};

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
    <div className="rwy-select-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
        onClick={e => e.stopPropagation()}
        className="bubble-rwy-select"
        style={{ border: `1px solid ${color}44`, paddingRight: '24px' }}
      >
        {freeRunways.map(r => <option key={r} value={r} style={{ background: '#111', color: '#fff' }}>RWY {r}</option>)}
      </select>
      <ChevronRight size={10} style={{ position: 'absolute', right: 8, transform: 'rotate(90deg)', pointerEvents: 'none', opacity: 0.5 }} />
    </div>
  );
}

// ── Single Bubble ─────────────────────────────────────────────────────────────

function ATCBubble({ flight, index, openId, setOpenId }) {
  const [runway, setRunway]     = useState(flight.runway || '27R');
  const [loading, setLoading]   = useState(false);
  const [approved, setApproved] = useState(false);
  const meta = PHASE_META[flight.phase];
  if (!meta) return null;

  const isOpen   = openId === flight.id;
  const wc       = flight.weightClass || 'MEDIUM';
  const wcColor  = WEIGHT_COLORS[wc] || '#6b7280';
  const Icon     = meta.icon;

  useEffect(() => { setApproved(false); setLoading(false); }, [flight.id, flight.phase]);

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
        setApproved(true);
        setTimeout(() => setOpenId(null), 800);
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

      {/* ── DESIGNER CARD (Expanded) ────────────────────── */}
      <div className={`atc-bubble-card ${isOpen ? 'visible' : ''}`} style={{ '--meta-color': meta.color }}>
        <div className="bubble-card-main-header">
          <div className="bubble-card-header-left">
            <div className="bubble-card-callsign">{flight.id}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800 }}>{flight.airlineCode || 'AAL'}</span>
              <span className="bubble-weight-badge" style={{ color: wcColor, borderColor: `${wcColor}33`, background: `${wcColor}11` }}>{wc}</span>
            </div>
          </div>
          <button className="bubble-close-btn" onClick={() => setOpenId(null)}>
            <X size={12} />
          </button>
        </div>

        <div className="bubble-details-section">
          <div className="bubble-route-mini">
            <span>{flight.origin || 'UNKN'}</span>
            <Plane size={8} style={{ transform: 'rotate(90deg)', opacity: 0.5 }} />
            <span>EGLL</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: 'var(--accent-amber)', fontSize: 8, fontWeight: 800 }}>STA {fmtTime(flight.scheduledArrival)}</span>
          </div>

          <div className="bubble-grid-ultra">
            <div className="b-metric-cell">
              <label>ALT</label>
              <div className="b-val">{Math.round(flight.altitude || 0)}<small>FT</small></div>
            </div>
            <div className="b-metric-cell">
              <label>SPD</label>
              <div className="b-val">{Math.round(flight.speed)}<small>KT</small></div>
            </div>
            <div className="b-metric-cell">
              <label>SQWK</label>
              <div className="b-val" style={{ color: 'var(--accent-cyan)' }}>{flight.squawk || '7000'}</div>
            </div>
            <div className="b-metric-cell">
              <label>FUEL</label>
              <div className="b-val">{Math.round((flight.fuelKg || 0)/1000).toFixed(1)}<small>T</small></div>
            </div>
            <div className="b-metric-cell">
              <label>WIND</label>
              <div className="b-val">{Math.round(flight.windDirection || 270)}°/{Math.round(flight.windSpeed || 12)}</div>
            </div>
            <div className="b-metric-cell">
              <label>XWIND</label>
              <div className="b-val" style={{ color: Math.abs(flight.crosswindComp || 0) > 15 ? 'var(--accent-red)' : 'var(--accent-purple)' }}>
                {Math.abs(flight.crosswindComp || 0).toFixed(0)}<small>KT</small>
              </div>
            </div>
          </div>

          {flight.atcClearance && (
            <div className="bubble-atc-msg-compact">
              <Radio size={10} style={{ flexShrink: 0 }} />
              <span>{flight.atcClearance}</span>
            </div>
          )}
        </div>

        <div className="bubble-footer-strip">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <FreeRunwaySelect
                flightId={flight.id}
                value={runway}
                onChange={setRunway}
                color={meta.color}
              />
            </div>
            <div style={{ flex: 2 }}>
              <button
                className={`bubble-approve-pro ${approved ? 'approved' : ''}`}
                style={{ '--btn-color': meta.btnColor }}
                onClick={handleApprove}
                disabled={loading || approved}
              >
                {loading
                  ? <Loader size={14} className="spin" />
                  : approved
                    ? '✓ CLEARED'
                    : <><Navigation size={12} /> {meta.btnLabel}</>
                }
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

  const requests = flights.filter(f => {
    if (f.phase === 'WAITING' && !f.approvedForLanding) return true;
    if (f.phase === 'AT_STAND' && !f.approvedForTaxi) return true;
    if (f.phase === 'TAXI_OUT' && !f.approvedForTakeoff && f.progress >= 1) return true;
    return false;
  });

  // Close open bubble if its flight disappears
  useEffect(() => {
    if (openId && !requests.find(r => r.id === openId)) setOpenId(null);
  }, [requests.length]);

  if (requests.length === 0) return null;

  return (
    <div className="atc-bubbles-container">
      {requests.map((flight, i) => (
        <ATCBubble
          key={flight.id}
          flight={flight}
          index={i}
          openId={openId}
          setOpenId={setOpenId}
        />
      ))}

      {/* Badge showing total count */}
      {!openId && requests.length > 1 && (
        <div className="atc-bubbles-count-badge">
          {requests.length} PENDING
        </div>
      )}
    </div>
  );
}
