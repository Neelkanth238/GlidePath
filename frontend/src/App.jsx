// App.jsx — Root layout: GlidePath 3D Visualizer
// Orchestrates the high-fidelity 3D viewport, real-time sidebar, and cinematic overlays.

import React, { useState, useEffect } from 'react';
import { Plane, Wind, Cpu, Layout, Crosshair, TowerControl as Tower, MousePointer2, List, Map as MapIcon, Bell, Info, Sun, Moon } from 'lucide-react';
import { WebSocketManager } from './components/WebSocketManager';
import { FlightList } from './components/FlightList';
import { Map2D } from './components/Map2D';
import { DetailPanel } from './components/DetailPanel';
import { ATCBubbles } from './components/ATCBubbles';
import { View3D } from './components/Scene3D/View3D';
import { useFlightStore } from './store/useFlightStore';

function Header({ panels, togglePanel }) {
  const cameraMode = useFlightStore(s => s.cameraMode);
  const setCameraMode = useFlightStore(s => s.setCameraMode);
  const connected = useFlightStore(s => s.connected);
  const theme = useFlightStore(s => s.theme);
  const toggleTheme = useFlightStore(s => s.toggleTheme);

  return (
    <header className="app-header">
      <div className="app-header__logo">
        <Wind className="app-header__logo-icon" size={20} />
        <span>GLIDEPATH <small style={{ opacity: 0.5, fontWeight: 300 }}>OPERATIONS</small></span>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <button className={`cam-btn ${cameraMode === 'TOWER' ? 'active' : ''}`} onClick={() => setCameraMode('TOWER')}>
          <Tower size={12} /> TOWER
        </button>
        <button className={`cam-btn ${cameraMode === 'FOLLOW' ? 'active' : ''}`} onClick={() => setCameraMode('FOLLOW')}>
          <Crosshair size={12} /> TARGET
        </button>
        <button className={`cam-btn ${cameraMode === 'RUNWAY' ? 'active' : ''}`} onClick={() => setCameraMode('RUNWAY')}>
          <Layout size={12} /> RUNWAY
        </button>
        <button className={`cam-btn ${cameraMode === 'FREEFLY' ? 'active' : ''}`} onClick={() => setCameraMode('FREEFLY')}>
          <MousePointer2 size={12} /> FREE
        </button>
      </div>

      <div className="app-header__status">
        <div style={{ display: 'flex', gap: '6px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '16px', marginRight: '16px' }}>
          <button className={`cam-btn ${panels.list ? 'active' : ''}`} onClick={() => togglePanel('list')}><List size={14} /></button>
          <button className={`cam-btn ${panels.blueprint ? 'active' : ''}`} onClick={() => togglePanel('blueprint')}><MapIcon size={14} /></button>
          <button className="cam-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="status-dot" style={{ color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }} />
          <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '1px', opacity: 0.8 }}>
            {connected ? 'LINK ACTIVE' : 'LINK LOST'}
          </span>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const selectedFlightId = useFlightStore(s => s.selectedFlightId);
  const theme = useFlightStore(s => s.theme);

  // Control visibility of various overlay sections
  const [panels, setPanels] = useState({
    blueprint: false, // Blueprint Map
    list: false,      // Flight List
    requests: true,   // Arrival Requests (initially shown)
  });

  const togglePanel = (key) => setPanels(p => ({ ...p, [key]: !p[key] }));

  // We rely on selectedFlightId itself to toggle the DetailPanel, 
  // so no explicit toggle needed, it just pops up when active.

  return (
    <div className={`app-shell glass-layout ${theme === 'light' ? 'light-theme' : ''}`}>
      {/* Real-time sync engine */}
      <WebSocketManager />

      {/* Cinematic Top Navigation */}
      <Header panels={panels} togglePanel={togglePanel} />

      {/* High-Fidelity 3D Viewport Full Background */}
      <main className="viewport background-scene">
        <View3D />
      </main>

      {/* Overlay Glass Panels */}
      <div className="overlay-panels">
        {/* Left Panels Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '380px', pointerEvents: 'none' }}>
          
          {panels.blueprint && (
            <aside className="glass-panel ui-container popup-animation" style={{ flex: '0 0 auto', pointerEvents: 'auto' }}>
              <div className="panel-header">
                <h3>Airport Blueprint</h3>
              </div>
              <div className="blueprint-container" style={{ marginBottom: 0, height: '240px' }}>
                <Map2D />
              </div>
            </aside>
          )}

          {panels.list && (
            <aside className="glass-panel ui-container popup-animation" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
              <div className="panel-header">
                <h3>Active Flights</h3>
              </div>
              <div className="panel-scroll-content" style={{ marginTop: '12px' }}>
                <FlightList />
              </div>
            </aside>
          )}

        </div>

        {/* Right Side Placements — Automated Bubbles */}
        <ATCBubbles />

        {/* Floating details popup (Absolutely positioned by CSS) */}
        {selectedFlightId && <DetailPanel />}
      </div>
    </div>
  );
}
