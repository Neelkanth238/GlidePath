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
    sx: (x / 280) * 240 + 20,
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
        cx: (x / 280) * (w - 20) + 10,
        cy: ((z + 200) / 520) * (h - 10) + 5,
      };
    }

    ctx.clearRect(0, 0, W, H);

    // ── Background ──
    ctx.fillStyle = '#060b16';
    ctx.fillRect(0, 0, w, h);

    // ── Grass areas ──
    ctx.fillStyle = '#0a1520';
    ctx.fillRect(0, 0, w, h);

    // ── Landing Runway (x=0, z=-260 to 260) ──
    const rwyStart = tp(-13, -260);
    const rwyEnd   = tp(13, 260);
    ctx.fillStyle = '#1a2535';
    ctx.fillRect(rwyStart.cx, rwyStart.cy, rwyEnd.cx - rwyStart.cx, rwyEnd.cy - rwyStart.cy);
    ctx.strokeStyle = '#2a3a55';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(rwyStart.cx, rwyStart.cy, rwyEnd.cx - rwyStart.cx, rwyEnd.cy - rwyStart.cy);

    // Centre-line dashes (Landing)
    ctx.strokeStyle = '#3d5a8a';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo((rwyStart.cx + rwyEnd.cx) / 2, rwyStart.cy);
    ctx.lineTo((rwyStart.cx + rwyEnd.cx) / 2, rwyEnd.cy);
    ctx.stroke();
    
    // ── Takeoff Runway (x=70, z=-260 to 260) ──
    const rwy2Start = tp(57, -260);
    const rwy2End   = tp(83, 260);
    ctx.fillStyle = '#1a2535';
    ctx.fillRect(rwy2Start.cx, rwy2Start.cy, rwy2End.cx - rwy2Start.cx, rwy2End.cy - rwy2Start.cy);
    ctx.strokeStyle = '#2a3a55';
    ctx.strokeRect(rwy2Start.cx, rwy2Start.cy, rwy2End.cx - rwy2Start.cx, rwy2End.cy - rwy2Start.cy);
    
    // Centre-line dashes (Takeoff)
    ctx.beginPath();
    ctx.moveTo((rwy2Start.cx + rwy2End.cx) / 2, rwy2Start.cy);
    ctx.lineTo((rwy2Start.cx + rwy2End.cx) / 2, rwy2End.cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Vertical Taxiway "plane run after and before terminal" (x=180, z=-220 to 220) ──
    const vtwy1 = tp(174, -220);
    const vtwy2 = tp(186, 220);
    ctx.fillStyle = '#131d2e';
    ctx.fillRect(vtwy1.cx, vtwy1.cy, vtwy2.cx - vtwy1.cx, vtwy2.cy - vtwy1.cy);

    // ── Top Cross Taxiway bridge (z=-100) bridging 0 to 180 (Arrivals) ──
    const cross1Start = tp(0, -106);
    const cross1End = tp(180, -94);
    ctx.fillRect(cross1Start.cx, cross1Start.cy, cross1End.cx - cross1Start.cx, cross1End.cy - cross1Start.cy);

    // ── Bottom Cross Taxiway bridge (z=140) bridging 70 to 180 (Departures) ──
    const depStart = tp(70, 134);
    const depEnd = tp(180, 146);
    ctx.fillRect(depStart.cx, depStart.cy, depEnd.cx - depStart.cx, depEnd.cy - depStart.cy);

    // ── Single Connector to Terminal (z=0 from x=180 to x=210) ──
    const termConnStart = tp(180, -6);
    const termConnEnd = tp(210, 6);
    ctx.fillRect(termConnStart.cx, termConnStart.cy, termConnEnd.cx - termConnStart.cx, termConnEnd.cy - termConnStart.cy);

    // ── Terminal building ──
    const term1 = tp(215, -40);
    const term2 = tp(280, 55);
    ctx.fillStyle = '#1a2d4a';
    ctx.fillRect(term1.cx, term1.cy, term2.cx - term1.cx, term2.cy - term1.cy);
    ctx.strokeStyle = '#2a4070';
    ctx.lineWidth = 1;
    ctx.strokeRect(term1.cx, term1.cy, term2.cx - term1.cx, term2.cy - term1.cy);

    // Terminal label
    ctx.fillStyle = '#3d5a8a';
    ctx.font = `${Math.max(7, w * 0.04)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('TERMINAL', (term1.cx + term2.cx) / 2, (term1.cy + term2.cy) / 2 + 3);

    // ── Stands (dots next to terminal) ──
    const stands = ['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4'];
    stands.forEach((stand) => {
      const standLetter = stand.charCodeAt(0) - 65;
      const standNum = parseInt(stand[1] || '1');
      const sx = 200 + standLetter * 22;
      const sz = -30 + standNum * 22;
      const { cx, cy } = tp(sx, sz);
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#2a4070';
      ctx.fill();
    });

    // ── Aircraft blips ──
    for (const flight of flights) {
      const { cx, cy } = tp(flight.position.x, flight.position.z);
      const color = PHASE_COLOURS[flight.phase] || '#3b82f6';
      const isAirborne = ['APPROACH', 'TAKEOFF'].includes(flight.phase);
      const isSelectedF = flight.id === selected;
      const r = isSelectedF ? 5 : 3.5;

      // Glow
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
      grd.addColorStop(0, color + '80');
      grd.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core blip
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Airborne ring
      if (isAirborne) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = color + '80';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Callsign label for selected
      if (isSelectedF) {
        ctx.fillStyle = '#e8eeff';
        ctx.font = `bold ${Math.max(8, w * 0.038)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(flight.id, cx + 7, cy + 4);
      }
    }

    // ── "09/27R" runway labels ──
    ctx.fillStyle = '#3d5a8a';
    ctx.font = `${Math.max(7, w * 0.036)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    
    // Landing Runway (x=0)
    const labelTop = tp(0, -270);
    const labelBot = tp(0,  270);
    ctx.fillText('09L', labelTop.cx, labelTop.cy);
    ctx.fillText('27R', labelBot.cx, labelBot.cy);

    // Takeoff Runway (x=70)
    const labelTop2 = tp(70, -270);
    const labelBot2 = tp(70,  270);
    ctx.fillText('09R', labelTop2.cx, labelTop2.cy);
    ctx.fillText('27L', labelBot2.cx, labelBot2.cy);

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
        cx: (x / 280) * (w - 20) + 10,
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
