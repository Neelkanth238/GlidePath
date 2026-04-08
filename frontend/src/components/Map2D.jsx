// Map2D.jsx — Top-down SVG schematic of the airport
// Shows runways, taxiways, terminal, stands, and live blip positions.
// Coordinate space: backend X/Z → SVG x/y (Y is vertical = altitude, ignored in 2D)

import React, { useRef, useEffect } from 'react';
import { useFlightStore } from '../store/useFlightStore';

// Airport schematic config (all values in SVG user units, 0-280 wide, 0-220 tall)
// Scene coordinates (backend) are roughly: X: 0-160, Z: -200 to 300
// We map: svgX = (sceneX / 180) * 240 + 20
//         svgY = (sceneZ + 200) / 500 * 200 + 10

function toSvg(x, z) {
  return {
    sx: ((x + 250) / 850) * 240 + 20,
    sy: ((z + 200) / 520) * 200 + 10,
  };
}

const PHASE_COLOURS = {
  WAITING: '#ef4444', APPROACH: '#8b5cf6', LANDING: '#3b82f6', ROLL_OUT: '#06b6d4',
  RUNWAY_EXIT: '#10b981', TAXI_IN: '#22d3ee', AT_STAND: '#10b981',
  PUSHBACK: '#f59e0b', TAXI_OUT: '#f97316', LINE_UP: '#ef4444', TAKEOFF: '#ec4899',
};

export function Map2D() {
  const canvasRef = useRef(null);
  const flights   = useFlightStore(s => s.flights);
  const selected  = useFlightStore(s => s.selectedFlightId);
  const select    = useFlightStore(s => s.selectFlight);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    // Helper to convert backend scene coords to canvas pixels
    function tp(x, z) {
      return {
        cx: ((x + 250) / 850) * (w - 20) + 10,
        cy: ((z + 200) / 520) * (h - 10) + 5,
      };
    }

    ctx.clearRect(0, 0, W, H);
    const theme = useFlightStore.getState().theme;
    const isLight = theme === 'light';

    // ── Background ──
    ctx.fillStyle = isLight ? '#f8fafc' : '#020202';
    ctx.fillRect(0, 0, w, h);

    // ── Subtle Radar Grids ──
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < w; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
    for (let i = 0; i < h; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }

    const RUNWAY_XS = [-200, -100, 0, 420, 540];
    
    // ── Runways ──
    RUNWAY_XS.forEach(rx => {
      const rStart = tp(rx - 13, -260);
      const rEnd   = tp(rx + 13, 260);
      ctx.fillStyle = isLight ? '#e2e8f0' : '#0a0f1a';
      ctx.fillRect(rStart.cx, rStart.cy, rEnd.cx - rStart.cx, rEnd.cy - rStart.cy);
      ctx.strokeStyle = isLight ? '#cbd5e1' : '#1e293b';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(rStart.cx, rStart.cy, rEnd.cx - rStart.cx, rEnd.cy - rStart.cy);

      // Centre-line dashes (Subtle tactical look)
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo((rStart.cx + rEnd.cx) / 2, rStart.cy);
      ctx.lineTo((rStart.cx + rEnd.cx) / 2, rEnd.cy);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // ── Taxiways (Simplified for tactical look) ──
    ctx.fillStyle = isLight ? '#cbd5e1' : '#080c14';
    const vtwy1L = tp(174, -220);
    const vtwy2L = tp(186, 220);
    ctx.fillRect(vtwy1L.cx, vtwy1L.cy, vtwy2L.cx - vtwy1L.cx, vtwy2L.cy - vtwy1L.cy);
    const vtwy1R = tp(304, -220);
    const vtwy2R = tp(316, 220);
    ctx.fillRect(vtwy1R.cx, vtwy1R.cy, vtwy2R.cx - vtwy1R.cx, vtwy2R.cy - vtwy1R.cy);

    // ── Terminal Tactical Outline ──
    const term1 = tp(215, -40);
    const term2 = tp(280, 55);
    ctx.strokeStyle = isLight ? '#94a3b8' : '#1e293b';
    ctx.strokeRect(term1.cx, term1.cy, term2.cx - term1.cx, term2.cy - term1.cy);

    // ── Aircraft blips (TACTICAL RADAR TARGETS) ──
    for (const flight of flights) {
      if (!flight.position) continue;
      const { cx, cy } = tp(flight.position.x, flight.position.z);
      const color = PHASE_COLOURS[flight.phase] || '#3b82f6';
      const isSelectedF = flight.id === selected;
      
      // Target Symbol
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelectedF ? 2 : 1.5;
      
      // Draw a tactical "crosshair" for the aircraft
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4);
      ctx.stroke();

      if (isSelectedF) {
        // Selection Square
        ctx.strokeRect(cx - 6, cy - 6, 12, 12);
        
        // Data Block (Tactical)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(flight.id, cx + 10, cy - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '7px JetBrains Mono, monospace';
        ctx.fillText(`${Math.round(flight.altitude || 0)}FT`, cx + 10, cy + 6);
      }
    }

    // ── Runway labels ──
    ctx.fillStyle = '#3d5a8a';
    ctx.font = `${Math.max(7, w * 0.036)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    
    const rwLabels = [
      { top: '09R', bot: '27L' },
      { top: '09C', bot: '27C' },
      { top: '09L', bot: '27R' },
      { top: '10R', bot: '28L' },
      { top: '10L', bot: '28R' }
    ];

    RUNWAY_XS.forEach((rx, i) => {
      const labelTop = tp(rx, -270);
      const labelBot = tp(rx,  270);
      ctx.fillText(rwLabels[i].top, labelTop.cx, labelTop.cy);
      ctx.fillText(rwLabels[i].bot, labelBot.cx, labelBot.cy);
    });

  }, [flights, selected]);

  function handleClick(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    function tp(x, z) {
      return {
        cx: ((x + 250) / 850) * (w - 20) + 10,
        cy: ((z + 200) / 520) * (h - 10) + 5,
      };
    }

    // Find closest aircraft to click
    let best = null; let bestDist = 14; // 14px click radius
    for (const f of flights) {
      const { cx, cy } = tp(f.position.x, f.position.z);
      const dist = Math.hypot(clickX - cx, clickY - cy);
      if (dist < bestDist) { best = f; bestDist = dist; }
    }
    select(best ? best.id : null);
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
      onClick={handleClick}
    />
  );
}
