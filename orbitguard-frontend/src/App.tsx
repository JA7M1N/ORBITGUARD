import { useState, Suspense, lazy, useEffect } from 'react';
import axios from 'axios';
import { AlertOctagon, X } from 'lucide-react';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import type { ActivePanel } from './components/Sidebar';
import { API_BASE_URL, getWebSocketUrl } from './config';

const OrbitMapPage = lazy(() => import('./pages/OrbitMapPage').then(m => ({ default: m.OrbitMapPage })));
const ConjunctionPage = lazy(() => import('./pages/ConjunctionPage').then(m => ({ default: m.ConjunctionPage })));
const ReentryPage = lazy(() => import('./pages/ReentryPage').then(m => ({ default: m.ReentryPage })));
const AgentSwarmPage = lazy(() => import('./pages/AgentSwarmPage').then(m => ({ default: m.AgentSwarmPage })));
const CompliancePage = lazy(() => import('./pages/CompliancePage').then(m => ({ default: m.CompliancePage })));
const SolarWeatherPage = lazy(() => import('./pages/SolarWeatherPage').then(m => ({ default: m.SolarWeatherPage })));
const SatelliteCatalogPage = lazy(() => import('./pages/SatelliteCatalogPage').then(m => ({ default: m.SatelliteCatalogPage })));
const CopilotPage = lazy(() => import('./pages/CopilotPage').then(m => ({ default: m.CopilotPage })));
const LunarPage = lazy(() => import('./pages/LunarPage').then(m => ({ default: m.LunarPage })));
const SimulationPage = lazy(() => import('./pages/SimulationPage').then(m => ({ default: m.SimulationPage }))) as React.ComponentType<{ tourActive?: boolean }>;

function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('globe');
  const [selectedConjunction, setSelectedConjunction] = useState<{ id: string; satellite: string } | null>(null);
  const [solarAlert, setSolarAlert] = useState<{ type: 'geomagnetic' | 'flux'; val: number; scaler: number } | null>(null);
  const [solarMetrics, setSolarMetrics] = useState<{ ap: number; f10_7: number; drag_scaler: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'warning' | 'success' } | null>(null);

  // Cheatsheet state
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState<boolean>(false);

  // Tour states
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourTimeLeft, setTourTimeLeft] = useState<number>(0);
  const [tourSelectedSatId, setTourSelectedSatId] = useState<string | undefined>(undefined);
  const [tourIsTracking, setTourIsTracking] = useState<boolean>(false);
  const [tourCopilotQuery, setTourCopilotQuery] = useState<string>('');

  const startTour = () => {
    setTourStep(1);
  };

  const skipTour = () => {
    setTourStep(null);
  };

  useEffect(() => {
    const checkSolarWeather = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/solar`);
        const { ap, f10_7, drag_scaler } = response.data;
        setSolarMetrics({ ap, f10_7, drag_scaler });
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

  // Demo Tour Orchestrator Effect
  useEffect(() => {
    if (tourStep === null) {
      setTourSelectedSatId(undefined);
      setTourIsTracking(false);
      setTourCopilotQuery('');
      return;
    }

    let timer: any = null;

    if (tourStep === 1) {
      // Step 1: 3D Orbit Flight (Overview)
      setActivePanel('globe');
      setTourTimeLeft(15);
      // Wait for globe to load, then select and track ISS
      const selectTimer = setTimeout(() => {
        setTourSelectedSatId('25544');
        setTourIsTracking(true);
      }, 2000);

      timer = setInterval(() => {
        setTourTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setTourStep(2);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearTimeout(selectTimer);
        clearInterval(timer);
      };
    }

    if (tourStep === 2) {
      // Step 2: 3D Debris Collision Simulator
      setTourSelectedSatId(undefined);
      setTourIsTracking(false);
      setActivePanel('simulation');
      setTourTimeLeft(15);

      timer = setInterval(() => {
        setTourTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setTourStep(3);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }

    if (tourStep === 3) {
      // Step 3: Ground Station Refinement (Satellite Catalog)
      setActivePanel('satellites');
      setTourTimeLeft(15);

      timer = setInterval(() => {
        setTourTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setTourStep(4);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }

    if (tourStep === 4) {
      // Step 4: AI Emergency Resolution (Copilot)
      setActivePanel('copilot');
      setTourTimeLeft(15);
      setTourCopilotQuery('Generate an emergency Collision Avoidance Maneuver (CAM) proposal for ISS (NORAD 25544) close approach with CALSPHERE 1 (NORAD 900).');

      timer = setInterval(() => {
        setTourTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setTourStep(null); // End Tour!
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [tourStep]);

  // WebSocket Alerts Connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      try {
        const wsUrl = getWebSocketUrl('/api/ws/alerts');
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'solar_storm_rescreen') {
              setToast({ message: data.toast, type: 'warning' });
            } else if (data.event === 'solar_storm_cleared') {
              setToast({ message: data.toast, type: 'success' });
            }
          } catch (e) {
            console.error("Error parsing WebSocket alert message:", e);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWS, 3000);
        };
      } catch (err) {
        console.error("WebSocket connection error:", err);
      }
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleInitiateFiling = (eventId: string, satelliteName: string) => {
    setSelectedConjunction({ id: eventId, satellite: satelliteName });
    setActivePanel('compliance');
  };

  const triggerFlare = async (flareClass: 'C' | 'M' | 'X') => {
    try {
      await axios.post(`${API_BASE_URL}/api/solar/trigger-flare/${flareClass}`);
      setSolarAlert({ 
        type: 'geomagnetic', 
        val: flareClass === 'X' ? 54.2 : flareClass === 'M' ? 32.5 : 18.2, 
        scaler: flareClass === 'X' ? 3.06 : flareClass === 'M' ? 2.15 : 1.45 
      });
      const response = await axios.get(`${API_BASE_URL}/api/solar`);
      const { ap, f10_7, drag_scaler } = response.data;
      setSolarMetrics({ ap, f10_7, drag_scaler });
    } catch (err) {
      console.error("Error triggering solar simulation:", err);
      throw err;
    }
  };

  const clearFlare = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/solar/clear-flare`);
      setSolarAlert(null);
      const response = await axios.get(`${API_BASE_URL}/api/solar`);
      const { ap, f10_7, drag_scaler } = response.data;
      setSolarMetrics({ ap, f10_7, drag_scaler });
    } catch (err) {
      console.error("Error clearing solar simulation:", err);
      throw err;
    }
  };

  const toggleSolarSimulation = async () => {
    if (solarAlert) {
      await clearFlare();
    } else {
      await triggerFlare('X');
    }
  };

  // Simple render helper to show descriptive placeholders for this phase
  const renderPanelContent = () => {
    switch (activePanel) {
      case 'globe':
        return (
          <OrbitMapPage 
            isSimActive={!!solarAlert} 
            selectedSatIdOverride={tourStep === 1 ? tourSelectedSatId : undefined}
            isTrackingOverride={tourStep === 1 ? tourIsTracking : false}
          />
        );
        
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
        return <SatelliteCatalogPage tourActive={tourStep === 3} />;
        
      case 'copilot':
        return (
          <CopilotPage 
            tourQuery={tourStep === 4 ? tourCopilotQuery : undefined} 
            onTourQuerySent={() => setTourCopilotQuery('')}
          />
        );
        
      case 'lunar':
        return <LunarPage />;
        
      case 'simulation':
        return <SimulationPage tourActive={tourStep === 2} />;
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
      {/* 1. Global Header Section */}
      <Topbar 
        onToggleSim={toggleSolarSimulation} 
        isSimActive={!!solarAlert} 
        solarMetrics={solarMetrics}
        trackedCount={104}
        isTourActive={tourStep !== null}
        onStartTour={startTour}
        onToggleCheatsheet={() => setIsCheatsheetOpen(prev => !prev)}
        isCheatsheetActive={isCheatsheetOpen}
      />

      {/* 🎬 Hackathon Tour Status Banner */}
      {tourStep !== null && (
        <div className="mx-6 md:mx-8 mt-4 p-4 rounded-xl border border-blue-500/25 bg-blue-950/20 text-blue-400 font-mono text-xs flex items-center justify-between shadow-[0_0_15px_rgba(59,130,246,0.08)] animate-slide-in shrink-0">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-[10px] uppercase tracking-wider text-blue-350">
                HACKATHON DEMO TOUR ACTIVE (Step {tourStep}/4)
              </span>
              <span className="text-[11px] font-medium text-slate-350 font-sans">
                {tourStep === 1 && "Step 1: Programmatic 3D satellite flight and orbital tracking lock onto ISS (NORAD 25544)."}
                {tourStep === 2 && "Step 2: 3D Debris Collision Simulator convergent approach, impact flash, expanding shockwave & NASA fragment cloud."}
                {tourStep === 3 && "Step 3: Programmatic Ground Refinement selection & uncertainty reduction simulation."}
                {tourStep === 4 && "Step 4: Air-gapped AI Copilot emergency resolution prompt typing & submission."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-bold text-slate-450 uppercase font-mono">
              Next Step in {tourTimeLeft}s
            </div>
            <button 
              onClick={skipTour}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
            >
              Skip Tour
            </button>
          </div>
        </div>
      )}

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

      {/* Premium Toast Notification Pop-up */}
      {/* ℹ sliding Judge Architecture & Q&A Drawer */}
      {isCheatsheetOpen && (
        <>
          {/* Backdrop blur overlay */}
          <div 
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-all duration-300"
            onClick={() => setIsCheatsheetOpen(false)}
          />
          
          {/* Slide-in panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-96 bg-slate-900/95 border-l border-slate-800 p-6 flex flex-col gap-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] glassmorphism animate-slide-in overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <h3 className="font-mono text-sm font-bold tracking-wider text-slate-100 uppercase">
                  System Architecture & Q&A
                </h3>
              </div>
              <button
                onClick={() => setIsCheatsheetOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-850/50 cursor-pointer transition-colors"
                title="Close Panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-5 text-xs font-sans text-slate-300 leading-relaxed pr-1">
              
              {/* FAQ Section 1: Stack */}
              <div className="flex flex-col gap-1.5">
                <h4 className="font-mono text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                  Q1: What is the core platform stack?
                </h4>
                <p className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-slate-350 leading-normal">
                  <strong className="text-slate-200">Frontend:</strong> React, CesiumJS 3D Globe, Lucide Icons, and custom vanilla CSS.<br />
                  <strong className="text-slate-200">Backend:</strong> FastAPI, SGP4 propagator engine, KD-Tree spatial close approach indexing, and SQLite.
                </p>
              </div>

              {/* FAQ Section 2: Real-time physics */}
              <div className="flex flex-col gap-1.5">
                <h4 className="font-mono text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                  Q2: How are orbits calculated dynamically?
                </h4>
                <p className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-slate-350 leading-normal">
                  We initialize the satellite catalog utilizing active TLE data. Paths are dynamically propagated using the analytical <strong className="text-slate-200">SGP4 algorithm</strong> with high-performance C-extensions. Collision risk calculates the <strong className="text-slate-200">Chan close-approach probability algorithm</strong> over covariance matrices.
                </p>
              </div>

              {/* FAQ Section 3: AI security */}
              <div className="flex flex-col gap-1.5">
                <h4 className="font-mono text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                  Q3: How does the AI Copilot remain secure?
                </h4>
                <p className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-slate-350 leading-normal">
                  The Space Copilot runs completely local, secure RAG queries. Prompt generation templates access air-gapped sqlite database tables for satellite details, orbital vectors, and solar weather. Telemetries are never leaked to external public APIs.
                </p>
              </div>

              {/* FAQ Section 4: Space Weather physics */}
              <div className="flex flex-col gap-1.5">
                <h4 className="font-mono text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                  Q4: What is the Space Weather drag model?
                </h4>
                <p className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-slate-350 leading-normal">
                  Geomagnetic storms (Ap spikes) and solar flux elevations (F10.7 spikes) expand the Earth's thermosphere density. The propagator integrates a dynamic density scaler ($C_d$) to accelerate orbital decay on low-altitude (LEO) catalog objects.
                </p>
              </div>

              {/* Technical Validation Badges */}
              <div className="border-t border-slate-800 pt-4 mt-2 flex flex-wrap gap-2 justify-center">
                <span className="px-2 py-1 bg-slate-950 border border-slate-850 text-slate-400 font-mono text-[8px] font-bold uppercase rounded-md tracking-wider">
                  SGP4 Solver: Verified
                </span>
                <span className="px-2 py-1 bg-slate-950 border border-slate-850 text-slate-400 font-mono text-[8px] font-bold uppercase rounded-md tracking-wider">
                  KD-Tree: 2.8ms Latency
                </span>
                <span className="px-2 py-1 bg-slate-950 border border-slate-850 text-slate-400 font-mono text-[8px] font-bold uppercase rounded-md tracking-wider">
                  AI: Local Llama RAG
                </span>
              </div>
              
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 border font-mono text-[11px] animate-slide-in glassmorphism max-w-sm
          ${toast.type === 'warning' 
            ? 'border-orange-500/35 bg-orange-950/20 text-orange-400' 
            : 'border-emerald-500/35 bg-emerald-950/20 text-emerald-400'
          }`}
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${toast.type === 'warning' ? 'bg-orange-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
          <div className="flex-1">
            <div className="font-bold uppercase tracking-wider mb-0.5">
              {toast.type === 'warning' ? "Solar Activity Alert" : "Weather Cleared"}
            </div>
            <div className="text-slate-300 font-sans leading-relaxed text-xs">{toast.message}</div>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-500 hover:text-slate-300 font-sans font-bold text-sm shrink-0 pl-2 self-start cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
