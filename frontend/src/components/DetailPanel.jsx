// DetailPanel.jsx — Premium flight inspection panel
// High-fidelity metrics and tracking controls for the selected target.

import React from 'react';
import { X, Target, Navigation, Gauge, ArrowUp, Compass, Clock } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';

function formatTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div className="metric-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <Icon size={12} color="var(--text-muted)" />
        <label>{label}</label>
      </div>
      <span className="value" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export function DetailPanel() {
  const flights = useFlightStore(s => s.flights);
  const selectedId = useFlightStore(s => s.selectedFlightId);
  const selectFlight = useFlightStore(s => s.selectFlight);
  const setCameraMode = useFlightStore(s => s.setCameraMode);

  const flight = flights.find(f => f.id === selectedId);
  const { inlineMode } = arguments[0] || {};

  if (!flight) {
    if (inlineMode) {
      return (
        <div className={`detail-panel ${inlineMode ? 'inline' : ''}`} style={{ padding: '0', background: 'transparent', border: 'none', backdropFilter: 'none' }}>
           <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '40px' }}>No plane selected</div>
        </div>
      );
    }
    return null;
  }

  const loadPercent = Math.min((flight.speed / 200) * 100, 100).toFixed(0);

  return (
    <div className={`detail-panel ${inlineMode ? 'inline' : 'popup-animation'}`} style={{ pointerEvents: 'auto' }}>
      <div className="detail-panel__header">
        <div>
          <h2 className="detail-panel__title" style={{ color: '#fff' }}>{flight.id}</h2>
          <div className="detail-panel__subtitle" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: '#71717a' }}>
            {flight.airline} / {flight.phase.replace(/_/g, ' ')}
            {flight.phase === 'WAITING' && !flight.approvedForLanding && (
              <span style={{ color: '#f59e0b', marginLeft: '6px' }}>(AWAITING CLEARANCE)</span>
            )}
          </div>
        </div>
        <button className="cam-btn" onClick={() => selectFlight(null)}>
          <X size={14} />
        </button>
      </div>

      <div className="detail-panel__technical-grid">
        <div className="technical-item">
          <label>SPD</label>
          <span>{Math.round(flight.speed)}<small>KT</small></span>
        </div>
        <div className="technical-item">
          <label>ALT</label>
          <span>{Math.round(flight.position.y * 10)}<small>FT</small></span>
        </div>
        <div className="technical-item">
          <label>HDG</label>
          <span>{Math.round(flight.heading)}<small>°</small></span>
        </div>
      </div>

      <div className="detail-panel__group">
        <div className="technical-item full">
          <label>RUNWAY ASSIGNMENT</label>
          <span style={{ fontSize: '16px' }}>{flight.runway || 'STANDBY'}</span>
        </div>
      </div>

      <div className="detail-panel__telemetry">
        <div className="telemetry-header">
          <label>PROPULSION TELEMETRY</label>
          <span>{loadPercent}% LOAD</span>
        </div>
        <div className="telemetry-line-container">
          <div className="telemetry-line" style={{ width: `${loadPercent}%` }} />
        </div>
        <div className="telemetry-oscilloscope">
           {[...Array(20)].map((_, i) => (
             <div key={i} className="osc-bar" style={{ height: `${Math.random() * 100}%`, opacity: 0.3 }} />
           ))}
        </div>
      </div>

      <div className="detail-panel__schedule-row">
        <div className="sch-item">STA <span>{formatTime(flight.scheduledArrival)}</span></div>
        <div className="sch-item">STD <span>{formatTime(flight.scheduledDeparture)}</span></div>
      </div>

      <button className="focus-btn" onClick={() => setCameraMode('FOLLOW')}>
        ESTABLISH TARGET LOCK
      </button>

      {flight.phase === 'WAITING' && !flight.approvedForLanding && (
        <button 
          onClick={async () => {
             try {
               await fetch(`http://localhost:8080/flights/${flight.id}/approve`, { method: 'POST' });
             } catch (err) {
               console.error('Failed to approve flight from quick view', err);
             }
          }}
          style={{
            marginTop: '8px',
            width: '100%',
            background: 'rgba(74, 222, 128, 0.15)',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            color: '#4ade80',
            padding: '12px',
            borderRadius: '6px',
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(74, 222, 128, 0.25)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)'}
        >
          <Navigation size={14} />
          APPROVE LANDING
        </button>
      )}
    </div>
  );
}

// Helper to avoid undefined error if lucide icon isn't imported correctly in the scope
const Activity = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);
