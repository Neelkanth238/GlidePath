// App.jsx — Root layout: GlidePath 3D Visualizer
// Orchestrates the high-fidelity 3D viewport, real-time sidebar, and cinematic overlays.

import React, { useState, useEffect } from 'react';
import { Plane, Wind, Cpu, Layout, Crosshair, TowerControl as Tower, MousePointer2, List, Map as MapIcon, Bell, Info, Sun, Moon } from 'lucide-react';
import { WebSocketManager } from './components/WebSocketManager';
import { FlightList } from './components/FlightList';
import { Map2D } from './components/Map2D';
import { DetailPanel } from './components/DetailPanel';
import { ArrivalRequests } from './components/ArrivalRequests';
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
        <Wind className="app-header__logo-icon" size={24} />
        <span>GLIDEPATH <span style={{ color: 'var(--text-muted)', fontWeight: 300 }}>3D</span></span>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <button
          className={`cam-btn ${cameraMode === 'TOWER' ? 'active' : ''}`}
          onClick={() => setCameraMode('TOWER')}
        >
          <Tower size={14} style={{ marginRight: '6px' }} />
          TOWER OVERVIEW
        </button>
        <button
          className={`cam-btn ${cameraMode === 'FOLLOW' ? 'active' : ''}`}
          onClick={() => setCameraMode('FOLLOW')}
        >
          <Crosshair size={14} style={{ marginRight: '6px' }} />
          FOLLOW TARGET
        </button>
        <button
          className={`cam-btn ${cameraMode === 'RUNWAY' ? 'active' : ''}`}
          onClick={() => setCameraMode('RUNWAY')}
        >
          <Layout size={14} style={{ marginRight: '6px' }} />
          RUNWAY CAM
        </button>
        <button
          className={`cam-btn ${cameraMode === 'FREEFLY' ? 'active' : ''}`}
          onClick={() => setCameraMode('FREEFLY')}
        >
          <MousePointer2 size={14} style={{ marginRight: '6px' }} />
          FREE CAM
        </button>
      </div>

      <div className="app-header__status" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Visibility Toggles */}
        <div style={{ display: 'flex', gap: '6px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '16px' }}>
          <button className={`cam-btn ${panels.list ? 'active' : ''}`} onClick={() => togglePanel('list')} title="Toggle Flight List"><List size={16} /></button>
          <button className={`cam-btn ${panels.blueprint ? 'active' : ''}`} onClick={() => togglePanel('blueprint')} title="Toggle Blueprint Map"><MapIcon size={16} /></button>
          <button className={`cam-btn ${panels.requests ? 'active' : ''}`} onClick={() => togglePanel('requests')} title="Toggle Arrival Requests"><Bell size={16} /></button>
          <button className="cam-btn" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={14} color={connected ? 'var(--accent-green)' : 'var(--accent-red)'} />
          <span>SYSTEM {connected ? 'READY' : 'OFFLINE'}</span>
          <div className="status-dot" style={{ background: connected ? 'var(--accent-green)' : 'var(--accent-red)' }} />
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

        {/* Right Side Placements */}
        <div className="panel-right-group" style={{ pointerEvents: 'none' }}>
          {/* Top Right Panel - Arrival Request */}
          {panels.requests && (
            <div className="glass-panel panel-right-top ui-container popup-animation" style={{ pointerEvents: 'auto' }}>
              <ArrivalRequests />
            </div>
          )}
        </div>

        {/* Floating details popup (Absolutely positioned by CSS) */}
        {selectedFlightId && <DetailPanel />}
      </div>
    </div>
  );
}
