import React from 'react';
import { PlaneTakeoff, Bell } from 'lucide-react';
import { useFlightStore } from '../store/useFlightStore';

export function ArrivalRequests() {
  const flights = useFlightStore(s => s.flights);
  
  // Filter incoming flights for "waiting for approval" visualization
  // Only hold planes that are in WAITING phase and not yet approved
  const arrivals = flights.filter(f => f.phase === 'WAITING' && !f.approvedForLanding);

  const handleApprove = async (id) => {
    try {
      await fetch(`http://localhost:8080/flights/${id}/approve`, { method: 'POST' });
    } catch (err) {
      console.error('Approval failed', err);
    }
  };

  return (
    <div className="arrival-requests">
      <div className="panel-header">
        <Bell size={16} />
        <h3>Arrival Requests</h3>
        <span className="badge">{arrivals.length}</span>
      </div>
      <p className="panel-desc">here it shows the plane arrival request and waiting for approval</p>
      
      <div className="arrival-list">
        {arrivals.length > 0 ? (
          arrivals.map(flight => (
            <div key={flight.id} className="arrival-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="arrival-icon">
                  <PlaneTakeoff size={14} style={{ color: 'var(--accent-cyan)' }} /> 
                </div>
                <div className="arrival-info">
                  <div className="arrival-callsign">{flight.id}</div>
                  <div className="arrival-status">Holding Pattern</div>
                </div>
              </div>
              <button 
                className="approve-btn" 
                onClick={() => handleApprove(flight.id)}
              >
                APPROVE
              </button>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '10px' }}>No pending arrivals</div>
        )}
      </div>
    </div>
  );
}
