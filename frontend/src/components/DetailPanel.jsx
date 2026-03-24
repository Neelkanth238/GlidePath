// DetailPanel.jsx — Real Airport Operations Panel
// Shows every measurement an ATC / operations officer would see in a real airport.

import React, { useRef, useState, useEffect } from 'react';
import { X, Navigation, Plane, Radio, Wind, Thermometer, Gauge, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';

function fmt(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Phase colour mapping
const PHASE_COLORS = {
  WAITING:      '#f59e0b',
  APPROACH:     '#06b6d4',
  LANDING:      '#10b981',
  ROLL_OUT:     '#3b82f6',
  RUNWAY_EXIT:  '#8b5cf6',
  TAXI_IN:      '#a78bfa',
  AT_STAND:     '#6b7280',
  PUSHBACK:     '#f97316',
  TAXI_OUT:     '#fbbf24',
  LINE_UP:      '#ef4444',
  TAKEOFF:      '#ec4899',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Row({ label, value, unit, color, warn }) {
  return (
    <div className="dp-row" style={{ borderColor: warn ? 'rgba(239,68,68,0.3)' : undefined }}>
      <span className="dp-row__label">{label}</span>
      <span className="dp-row__value" style={{ color: warn ? '#ef4444' : (color || 'var(--text-primary)') }}>
        {value}<small style={{ opacity: 0.6, marginLeft: 2 }}>{unit}</small>
      </span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="dp-section-header">
      {Icon && <Icon size={11} style={{ opacity: 0.7 }} />}
      <span>{title}</span>
    </div>
  );
}

function GaugeMeter({ label, value, max, unit, color, warn }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="dp-gauge">
      <div className="dp-gauge__label">{label}</div>
      <div className="dp-gauge__bar-bg">
        <div className="dp-gauge__bar" style={{ width: `${pct}%`, background: warn ? '#ef4444' : (color || 'var(--accent-cyan)') }} />
      </div>
      <div className="dp-gauge__value" style={{ color: warn ? '#ef4444' : undefined }}>
        {typeof value === 'number' ? Math.round(value) : value}{unit}
      </div>
    </div>
  );
}

function ILSDisplay({ gs, loc }) {
  const gsPos = clamp(50 + (gs || 0) * 20, 5, 95);
  const locPos = clamp(50 + (loc || 0) * 20, 5, 95);
  const gsWarn = Math.abs(gs || 0) > 1;
  const locWarn = Math.abs(loc || 0) > 1;
  return (
    <div className="dp-ils">
      <div className="dp-ils__title">ILS DEVIATION</div>
      <div className="dp-ils__grid">
        <div className="dp-ils__axis-label">G/S</div>
        <div className="dp-ils__track">
          <div className="dp-ils__center" />
          <div className="dp-ils__dot" style={{ left: `${gsPos}%`, background: gsWarn ? '#ef4444' : '#10b981' }} />
        </div>
        <div className="dp-ils__axis-label">LOC</div>
        <div className="dp-ils__track">
          <div className="dp-ils__center" />
          <div className="dp-ils__dot" style={{ left: `${locPos}%`, background: locWarn ? '#ef4444' : '#10b981' }} />
        </div>
      </div>
    </div>
  );
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function GearIndicator({ state }) {
  const color = state === 'DOWN' ? '#10b981' : state === 'TRANSIT' ? '#f59e0b' : '#6b7280';
  const label = state || 'UP';
  return (
    <div className="dp-gear">
      <div className="dp-gear__icon" style={{ color }}>
        ▼▼▼
      </div>
      <div className="dp-gear__label" style={{ color }}>{label}</div>
    </div>
  );
}

function BrakeTemps({ temps = [180, 180, 180, 180] }) {
  const max = 700;
  return (
    <div className="dp-brakes">
      {temps.map((t, i) => {
        const pct = (t / max) * 100;
        const col = t > 500 ? '#ef4444' : t > 300 ? '#f59e0b' : '#10b981';
        return (
          <div key={i} className="dp-brake-bar">
            <div className="dp-brake-bar__fill" style={{ height: `${pct}%`, background: col }} />
            <span className="dp-brake-bar__label">{Math.round(t)}°</span>
          </div>
        );
      })}
    </div>
  );
}

function AtcLog({ log = [] }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);

  return (
    <div className="dp-atc-log" ref={ref}>
      {log.slice(-8).map((entry, i) => (
        <div key={i} className={`dp-atc-entry dp-atc-${entry.from?.toLowerCase()}`}>
          <span className="dp-atc-from">[{entry.from}]</span>
          <span className="dp-atc-msg">{entry.msg}</span>
        </div>
      ))}
      {log.length === 0 && <div style={{ opacity: 0.4, fontSize: 9 }}>NO ATC TRAFFIC</div>}
    </div>
  );
}

// per-phase measurement panels
function ApproachPanel({ f }) {
  return (
    <>
      <SectionHeader icon={Activity} title="ILS APPROACH" />
      <ILSDisplay gs={f.glideslopeDeviation} loc={f.localizerDeviation} />
      <Row label="GLIDESLOPE" value={`${(f.glideslopeAngle || 3).toFixed(1)}°`} color="#06b6d4" />
      <Row label="ILS FREQ" value={f.ilsFrequency || '—'} color="#a78bfa" />
      <Row label="VREF" value={f.vref} unit="KT" color="#f59e0b" />
      <Row label="VERTICAL SPD" value={Math.round(f.verticalSpeed || 0)} unit="fpm" color={f.verticalSpeed < -900 ? '#ef4444' : '#06b6d4'} warn={f.verticalSpeed < -1200} />
      <Row label="HEADWIND" value={f.headwindComp?.toFixed(1) || 0} unit="KT" />
      <Row label="CROSSWIND" value={Math.abs(f.crosswindComp || 0).toFixed(1)} unit="KT" warn={Math.abs(f.crosswindComp || 0) > 15} />
    </>
  );
}

function LandingPanel({ f }) {
  return (
    <>
      <SectionHeader icon={ArrowDown} title="LANDING" />
      <Row label="TOUCHDOWN RATE" value={Math.abs(f.touchdownRate || 0)} unit="fpm" color={f.touchdownRate < -300 ? '#ef4444' : '#10b981'} />
      <Row label="TOUCHDOWN G" value={(f.touchdownG || 1).toFixed(2)} unit="G" warn={(f.touchdownG || 1) > 1.8} />
      <Row label="SINK RATE" value={Math.abs(f.verticalSpeed || 0)} unit="fpm" />
      <Row label="PITCH" value={(f.pitchAngle || 0).toFixed(1)} unit="°" />
      <Row label="FLAPS" value={f.flapsConfig || 0} unit="°" />
      <GearIndicator state={f.gearState} />
    </>
  );
}

function RollOutPanel({ f }) {
  return (
    <>
      <SectionHeader icon={Gauge} title="GROUND ROLL" />
      <Row label="DECEL" value={(f.decelerationG || 0).toFixed(2)} unit="G" />
      <Row label="BRAKE PRESS" value={Math.round(f.brakePressure || 0)} unit="PSI" />
      <Row label="REV THRUST" value={f.thrustReverse ? 'DEPLOYED' : 'OFF'} color={f.thrustReverse ? '#ef4444' : '#6b7280'} />
      <Row label="RUNWAY OCC" value={(f.runwayOccupancyTimer || 0).toFixed(0)} unit="s" warn={(f.runwayOccupancyTimer || 0) > 60} />
      <SectionHeader title="BRAKE TEMPS" />
      <BrakeTemps temps={f.brakeTemp} />
    </>
  );
}

function TaxiPanel({ f }) {
  return (
    <>
      <SectionHeader title="GROUND MOVEMENT" />
      <Row label="STAND" value={f.stand || '—'} color="#a78bfa" />
      <Row label="TAXI SPD" value={Math.round(f.speed)} unit="KT" warn={f.speed > 25} />
      <Row label="BRAKE PRESS" value={Math.round(f.brakePressure || 0)} unit="PSI" />
      <SectionHeader title="BRAKE TEMPS" />
      <BrakeTemps temps={f.brakeTemp} />
    </>
  );
}

function StandPanel({ f }) {
  return (
    <>
      <SectionHeader title="AT STAND" />
      <Row label="STAND" value={f.stand} color="#a78bfa" />
      <Row label="CHOCKS" value="IN" color="#10b981" />
      <Row label="ENGINES" value="SHUTDOWN" color="#6b7280" />
      <Row label="BRAKE" value="PARKING" color="#f59e0b" />
      <Row label="STA" value={fmtTime(f.scheduledArrival)} />
      <Row label="STD" value={fmtTime(f.scheduledDeparture)} />
      <Row label="FUEL ONBOARD" value={Math.round(f.fuelKg || 0)} unit="kg" />
      <Row label="GROSS WEIGHT" value={Math.round((f.grossWeightKg || 0) / 1000).toFixed(1)} unit="t" />
    </>
  );
}

function TakeoffPanel({ f }) {
  return (
    <>
      <SectionHeader icon={ArrowUp} title="TAKEOFF" />
      <Row label="V1" value={(f.vref || 140) + 8} unit="KT" color="#f59e0b" />
      <Row label="VR (ROTATE)" value={f.rotateSpeed || 148} unit="KT" color="#f59e0b" />
      <Row label="V2" value={(f.rotateSpeed || 148) + 12} unit="KT" color="#06b6d4" />
      <Row label="N1 THRUST" value={f.engineN1?.[0] || 0} unit="%" color="#10b981" />
      <Row label="CLIMB RATE" value={Math.round(f.verticalSpeed || 0)} unit="fpm" color="#10b981" />
      <Row label="PITCH" value={(f.pitchAngle || 0).toFixed(1)} unit="°" />
      <GearIndicator state={f.gearState} />
      <Row label="FLAPS" value={f.flapsConfig || 0} unit="°" />
    </>
  );
}

function WaitingPanel({ f, onApprove }) {
  return (
    <>
      <SectionHeader title="HOLDING PATTERN" />
      <Row label="ALTITUDE" value={Math.round(f.altitude || 8000)} unit="ft" />
      <Row label="SPEED" value={Math.round(f.speed)} unit="KT" />
      <Row label="ORIGIN" value={f.origin || '—'} color="#a78bfa" />
      <Row label="SQUAWK" value={f.squawk || '7000'} color="#06b6d4" />
      <Row label="WEIGHT CLASS" value={f.weightClass || '—'} />
      <Row label="AIRCRAFT" value={f.aircraftType || '—'} color="#f59e0b" />
      <Row label="FUEL" value={Math.round(f.fuelKg || 0)} unit="kg" />
      <div style={{ marginTop: 12 }}>
        <button
          className="dp-approve-btn"
          onClick={onApprove}
        >
          <Navigation size={13} />
          APPROVE ILS APPROACH — RWY {f.runway}
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function DetailPanel() {
  const flights        = useFlightStore(s => s.flights);
  const selectedId     = useFlightStore(s => s.selectedFlightId);
  const selectFlight   = useFlightStore(s => s.selectFlight);
  const setCameraMode  = useFlightStore(s => s.setCameraMode);

  const flight = flights.find(f => f.id === selectedId);
  const { inlineMode } = arguments[0] || {};

  if (!flight) {
    if (inlineMode) return (
      <div className={`detail-panel ${inlineMode ? 'inline' : ''}`} style={{ padding: 0, background: 'transparent', border: 'none', backdropFilter: 'none' }}>
        <div style={{ textAlign: 'center', opacity: 0.5, marginTop: 40, fontSize: 11 }}>No aircraft selected</div>
      </div>
    );
    return null;
  }

  const handleApprove = async () => {
    try {
      await fetch(`http://localhost:8080/flights/${flight.id}/approve`, { method: 'POST' });
    } catch (e) { console.error(e); }
  };

  const phaseColor = PHASE_COLORS[flight.phase] || '#ffffff';
  const loadPct    = Math.min((flight.speed / 200) * 100, 100);

  function PhasePanelContent() {
    switch (flight.phase) {
      case 'WAITING':     return <WaitingPanel f={flight} onApprove={handleApprove} />;
      case 'APPROACH':    return <ApproachPanel f={flight} />;
      case 'LANDING':     return <LandingPanel f={flight} />;
      case 'ROLL_OUT':    return <RollOutPanel f={flight} />;
      case 'RUNWAY_EXIT': return <TaxiPanel f={flight} />;
      case 'TAXI_IN':     return <TaxiPanel f={flight} />;
      case 'AT_STAND':    return <StandPanel f={flight} />;
      case 'PUSHBACK':    return <TaxiPanel f={flight} />;
      case 'TAXI_OUT':    return <TaxiPanel f={flight} />;
      case 'LINE_UP':     return <TakeoffPanel f={flight} />;
      case 'TAKEOFF':     return <TakeoffPanel f={flight} />;
      default: return null;
    }
  }

  return (
    <div className={`detail-panel dp-v2 ${inlineMode ? 'inline' : 'popup-animation'}`} style={{ pointerEvents: 'auto' }}>

      {/* Header */}
      <div className="dp-header">
        <div className="dp-header__left">
          <div className="dp-callsign">{flight.id}</div>
          <div className="dp-airline">{flight.airline} · {flight.aircraftType || ''}</div>
          <div className="dp-phase-badge" style={{ background: `${phaseColor}22`, color: phaseColor, borderColor: `${phaseColor}44` }}>
            {flight.phase.replace(/_/g, ' ')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button className="cam-btn" style={{ padding: '4px 8px' }} onClick={() => selectFlight(null)}><X size={12} /></button>
          <div className="dp-squawk">{flight.squawk || '7000'}</div>
        </div>
      </div>

      {/* Top 3 metrics bar */}
      <div className="dp-metric-bar">
        <div className="dp-metric-bar__item">
          <span className="dp-metric-bar__label">GS</span>
          <span className="dp-metric-bar__value">{Math.round(flight.speed)}<small>KT</small></span>
        </div>
        <div className="dp-metric-bar__item">
          <span className="dp-metric-bar__label">ALT</span>
          <span className="dp-metric-bar__value">{Math.round(flight.altitude || flight.position.y * 10)}<small>FT</small></span>
        </div>
        <div className="dp-metric-bar__item">
          <span className="dp-metric-bar__label">HDG</span>
          <span className="dp-metric-bar__value">{Math.round(flight.heading)}<small>°</small></span>
        </div>
        <div className="dp-metric-bar__item">
          <span className="dp-metric-bar__label">V/S</span>
          <span className="dp-metric-bar__value" style={{ color: (flight.verticalSpeed || 0) < -800 ? '#ef4444' : undefined }}>
            {flight.verticalSpeed > 0 ? '+' : ''}{Math.round(flight.verticalSpeed || 0)}<small>fpm</small>
          </span>
        </div>
      </div>

      {/* Engine N1 bars */}
      <div className="dp-engine-row">
        {(flight.engineN1 || [75, 75]).map((n1, i) => (
          <GaugeMeter key={i} label={`ENG ${i + 1} N1`} value={n1} max={100} unit="%" color="#06b6d4" warn={n1 > 95} />
        ))}
      </div>

      {/* Phase-specific content */}
      <div className="dp-phase-content">
        <PhasePanelContent />
      </div>

      {/* Wind */}
      <div className="dp-wind-row">
        <Wind size={10} style={{ opacity: 0.6 }} />
        <span>WIND {Math.round(flight.windDirection || 270)}°/{Math.round(flight.windSpeed || 12)}KT</span>
        <span style={{ color: '#06b6d4' }}>HW {(flight.headwindComp || 0).toFixed(0)}KT</span>
        <span style={{ color: Math.abs(flight.crosswindComp || 0) > 15 ? '#ef4444' : '#a78bfa' }}>
          XW {Math.abs(flight.crosswindComp || 0).toFixed(0)}KT
        </span>
      </div>

      {/* ATC Log */}
      <div className="dp-section-header" style={{ marginTop: 10 }}>
        <Radio size={10} style={{ opacity: 0.7 }} />
        <span>ATC FREQUENCY LOG</span>
      </div>
      <AtcLog log={flight.atcLog} />

      {/* Footer buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="focus-btn" style={{ flex: 1 }} onClick={() => setCameraMode('FOLLOW')}>
          TARGET LOCK
        </button>
        {flight.phase === 'WAITING' && !flight.approvedForLanding && (
          <button className="dp-approve-btn" style={{ flex: 2 }} onClick={handleApprove}>
            <Navigation size={12} /> APPROVE
          </button>
        )}
      </div>

    </div>
  );
}
