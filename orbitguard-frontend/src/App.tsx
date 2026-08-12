import { useState, Suspense, lazy, useEffect } from 'react';
import axios from 'axios';
import { AlertOctagon } from 'lucide-react';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import type { ActivePanel } from './components/Sidebar';
import { API_BASE_URL } from './config';

const OrbitMapPage = lazy(() => import('./pages/OrbitMapPage').then(m => ({ default: m.OrbitMapPage })));
const ConjunctionPage = lazy(() => import('./pages/ConjunctionPage').then(m => ({ default: m.ConjunctionPage })));
const ReentryPage = lazy(() => import('./pages/ReentryPage').then(m => ({ default: m.ReentryPage })));
const AgentSwarmPage = lazy(() => import('./pages/AgentSwarmPage').then(m => ({ default: m.AgentSwarmPage })));
const CompliancePage = lazy(() => import('./pages/CompliancePage').then(m => ({ default: m.CompliancePage })));
const SolarWeatherPage = lazy(() => import('./pages/SolarWeatherPage').then(m => ({ default: m.SolarWeatherPage })));
const SatelliteCatalogPage = lazy(() => import('./pages/SatelliteCatalogPage').then(m => ({ default: m.SatelliteCatalogPage })));
const CopilotPage = lazy(() => import('./pages/CopilotPage').then(m => ({ default: m.CopilotPage })));
const LunarPage = lazy(() => import('./pages/LunarPage').then(m => ({ default: m.LunarPage })));

function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('globe');
  const [selectedConjunction, setSelectedConjunction] = useState<{ id: string; satellite: string } | null>(null);
  const [solarAlert, setSolarAlert] = useState<{ type: 'geomagnetic' | 'flux'; val: number; scaler: number } | null>(null);

  useEffect(() => {
    const checkSolarWeather = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/solar`);
        const { ap, f10_7, drag_scaler } = response.data;
        if (ap >= 20.0) {
          setSolarAlert({ type: 'geomagnetic', val: ap, scaler: drag_scaler });
        } else if (f10_7 >= 140.0) {
          setSolarAlert({ type: 'flux', val: f10_7, scaler: drag_scaler });
        }
      } catch (e) {
        console.error("Error loading space weather warnings:", e);
      }
    };
    checkSolarWeather();
  }, []);

  const handleInitiateFiling = (eventId: string, satelliteName: string) => {
    setSelectedConjunction({ id: eventId, satellite: satelliteName });
    setActivePanel('compliance');
  };

  const toggleSolarSimulation = () => {
    if (solarAlert) {
      setSolarAlert(null);
    } else {
      setSolarAlert({ type: 'geomagnetic', val: 54.2, scaler: 3.06 });
    }
  };

  // Simple render helper to show descriptive placeholders for this phase
  const renderPanelContent = () => {
    switch (activePanel) {
      case 'globe':
        return <OrbitMapPage isSimActive={!!solarAlert} />;
        
      case 'conjunctions':
        return <ConjunctionPage onInitiateFiling={handleInitiateFiling} />;
        
      case 'reentry':
        return <ReentryPage />;
        
      case 'swarm':
        return <AgentSwarmPage />;
        
      case 'compliance':
        return <CompliancePage selectedConjunction={selectedConjunction} />;
        
      case 'solar':
        return <SolarWeatherPage />;
        
      case 'satellites':
        return <SatelliteCatalogPage />;
        
      case 'copilot':
        return <CopilotPage />;
        
      case 'lunar':
        return <LunarPage />;
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
      {/* 1. Global Header Section */}
      <Topbar onToggleSim={toggleSolarSimulation} isSimActive={!!solarAlert} />

      {/* space weather warning banner */}
      {solarAlert && (
        <div className="mx-6 md:mx-8 mt-4 p-4 rounded-xl border border-red-500/20 bg-red-950/20 text-red-400 font-mono text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="h-4.5 w-4.5 shrink-0" />
            <span>
              {solarAlert.type === 'geomagnetic' ? (
                `SPACE WEATHER WARNING: Active Geomagnetic Storm (Ap: ${solarAlert.val.toFixed(1)}). Thermosphere density expanded by ${solarAlert.scaler.toFixed(2)}x. LEO spacecraft decay rates are elevated.`
              ) : (
                `SPACE WEATHER ALERT: Solar Radio Flux Elevation (F10.7: ${solarAlert.val.toFixed(1)} sfu). Enhanced drag profile active.`
              )}
            </span>
          </div>
          <button 
            onClick={() => setSolarAlert(null)}
            className="text-slate-400 hover:text-slate-200 ml-4 font-sans font-bold text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Main Dashboard Layout Frame */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <Sidebar activePanel={activePanel} setActivePanel={setActivePanel} />
        
        {/* Dynamic Main Panel Canvas */}
        <main className="flex-1 p-6 md:p-8 bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.15),transparent_60%)]">
          <Suspense fallback={
            <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-3 font-mono text-xs text-slate-500">
              <span className="animate-pulse">LOADING DASHBOARD COMPONENT...</span>
            </div>
          }>
            {renderPanelContent()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default App;
