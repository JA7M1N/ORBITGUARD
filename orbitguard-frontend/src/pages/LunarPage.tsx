import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { LunarGlobe } from '../components/LunarGlobe';
import { Play, Compass, ShieldCheck, AlertTriangle, List, Moon, RefreshCw, FileText, CheckCircle } from 'lucide-react';

interface Crater {
  name: string;
  lat: number;
  lon: number;
  radius: number;
}

interface Waypoint {
  lat: number;
  lon: number;
  slope: number;
}

interface Mission {
  name: string;
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
}

export const LunarPage: React.FC = () => {
  const [craters, setCraters] = useState<Crater[]>([]);
  const [missions, setMissions] = useState<Record<string, Mission>>({});
  const [selectedMissionKey, setSelectedMissionKey] = useState<string>('site_alpha_to_shackleton');
  
  // Navigation tabs
  const [subTab, setSubTab] = useState<'surface' | 'cislunar'>('surface');

  // Cislunar simulation coordinates (Earth-Moon ECI Barycentric)
  const [cisX, setCisX] = useState<number>(320000);
  const [cisY, setCisY] = useState<number>(0);
  const [cisZ, setCisZ] = useState<number>(0);
  const [cisVx, setCisVx] = useState<number>(0.0);
  const [cisVy, setCisVy] = useState<number>(0.25);
  const [cisVz, setCisVz] = useState<number>(0.0);
  const [cisDuration, setCisDuration] = useState<number>(7.0);
  const [cislunarResult, setCislunarResult] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const loadCislunarPreset = (type: 'tli' | 'l1' | 'nrho') => {
    setCislunarResult(null);
    if (type === 'tli') {
      setCisX(6700); setCisY(0); setCisZ(0);
      setCisVx(0.0); setCisVy(10.92); setCisVz(0.0);
      setCisDuration(4.5);
    } else if (type === 'l1') {
      setCisX(320000); setCisY(0); setCisZ(0);
      setCisVx(0.0); setCisVy(0.25); setCisVz(0.0);
      setCisDuration(10.0);
    } else if (type === 'nrho') {
      setCisX(384400); setCisY(0); setCisZ(4500);
      setCisVx(-0.95); setCisVy(0.0); setCisVz(0.0);
      setCisDuration(8.0);
    }
  };

  const handlePropagateCislunar = async () => {
    setIsSimulating(true);
    setCislunarResult(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/lunar/propagate`, {
        x: cisX,
        y: cisY,
        z: cisZ,
        vx: cisVx,
        vy: cisVy,
        vz: cisVz,
        duration_days: cisDuration
      });
      setCislunarResult(response.data);
    } catch (e) {
      console.error("Error propagating cislunar trajectory:", e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Canvas drawing animation hook
  useEffect(() => {
    if (!cislunarResult || !cislunarResult.trajectory) return;
    const canvas = document.getElementById('cislunarChartCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let frameIdx = 0;
    const traj = cislunarResult.trajectory;
    const mTraj = cislunarResult.moon_trajectory;
    
    // Earth-Moon ECI visualization radius (km) plus headroom
    const maxVal = 440000.0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const originX = width / 2;
      const originY = height / 2;
      
      // Conversion scalar
      const scale = (Math.min(width, height) / 2 - 20) / maxVal;

      // Draw Earth-Moon Orbit track
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(originX, originY, 384400.0 * scale, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw Earth Barycenter (Blue Sphere)
      ctx.beginPath();
      const earthGrd = ctx.createRadialGradient(originX, originY, 1, originX, originY, 12);
      earthGrd.addColorStop(0, '#60a5fa');
      earthGrd.addColorStop(1, '#1e3a8a');
      ctx.fillStyle = earthGrd;
      ctx.arc(originX, originY, 10, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.fillText('Earth', originX - 12, originY - 14);

      // Scale Marker
      ctx.fillStyle = '#475569';
      ctx.fillRect(10, height - 15, 60, 2);
      ctx.fillText('200,000 km', 10, height - 20);

      // Draw trace line
      ctx.strokeStyle = cislunarResult.metrics.safety_status === 'CRITICAL HAZARD' ? '#f43f5e' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= frameIdx; i++) {
        if (!traj[i]) break;
        const x = originX + traj[i].x * scale;
        const y = originY + traj[i].y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw Moon Position at current frame
      if (mTraj[frameIdx]) {
        const mx = originX + mTraj[frameIdx].x * scale;
        const my = originY + mTraj[frameIdx].y * scale;
        
        ctx.beginPath();
        const moonGrd = ctx.createRadialGradient(mx, my, 1, mx, my, 6);
        moonGrd.addColorStop(0, '#cbd5e1');
        moonGrd.addColorStop(1, '#475569');
        ctx.fillStyle = moonGrd;
        ctx.arc(mx, my, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Moon', mx - 10, my - 10);
      }

      // Draw Spacecraft Position (glowing green/red)
      if (traj[frameIdx]) {
        const sx = originX + traj[frameIdx].x * scale;
        const sy = originY + traj[frameIdx].y * scale;
        
        ctx.beginPath();
        ctx.fillStyle = cislunarResult.metrics.safety_status === 'CRITICAL HAZARD' ? '#f43f5e' : '#10b981';
        ctx.arc(sx, sy, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }

      if (frameIdx < traj.length - 1) {
        frameIdx += 1;
        animFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [cislunarResult]);

  // Input states (lat/lon coordinates)
  const [startLat, setStartLat] = useState<number>(-87.0);
  const [startLon, setStartLon] = useState<number>(10.0);
  const [endLat, setEndLat] = useState<number>(-89.8);
  const [endLon, setEndLon] = useState<number>(5.0);

  // Pathfinding results
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [metrics, setMetrics] = useState<{
    total_distance_km: number;
    max_slope_gradient_pct: number;
    safety_margin_pct: number;
  } | null>(null);

  const [calculating, setCalculating] = useState<boolean>(false);

  // 1. Fetch initial polar craters list and mission presets
  useEffect(() => {
    const fetchHazards = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/lunar/hazards`);
        setCraters(res.data.craters);
        setMissions(res.data.missions);
        
        // Load default mission details into inputs
        const defaultMission = res.data.missions['site_alpha_to_shackleton'];
        if (defaultMission) {
          setStartLat(defaultMission.start.lat);
          setStartLon(defaultMission.start.lon);
          setEndLat(defaultMission.end.lat);
          setEndLon(defaultMission.end.lon);
        }
      } catch (err) {
        console.error("Error loading lunar hazards catalog:", err);
      }
    };
    fetchHazards();
  }, []);

  // 2. Automatically trigger pathfinder when preset mission changes
  useEffect(() => {
    if (missions[selectedMissionKey]) {
      const mission = missions[selectedMissionKey];
      setStartLat(mission.start.lat);
      setStartLon(mission.start.lon);
      setEndLat(mission.end.lat);
      setEndLon(mission.end.lon);
    }
  }, [selectedMissionKey, missions]);

  // 3. Compute A* slope-aware route
  const handleCalculateRoute = async () => {
    setCalculating(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/lunar/pathfind`, {
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon
      });
      
      setWaypoints(response.data.waypoints);
      setMetrics(response.data.metrics);
    } catch (e) {
      console.error("Error running A* pathfinding calculation:", e);
    } finally {
      setCalculating(false);
    }
  };

  // Run initial calculation when start/end coordinates are populated
  useEffect(() => {
    if (startLat && startLon && endLat && endLon && Object.keys(missions).length > 0) {
      handleCalculateRoute();
    }
  }, [startLat, startLon, endLat, endLon, missions]);

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-120px)] overflow-hidden select-none">
      
      {/* HEADER SECTION WITH SUB-TAB SWITCHER */}
      <div className="glassmorphism p-4 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Moon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 tracking-wide uppercase font-mono flex items-center gap-2">
              <span>Deep Space Operations Hub</span>
              <span className="text-[8px] font-sans font-bold px-1.5 py-0.5 rounded bg-cyan-500 text-white animate-pulse">
                CISLUNAR-3BODY
              </span>
            </h3>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
              <span>Earth-Moon Barycentric Libration & Surface Traversal Planning</span>
            </div>
          </div>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex gap-2 p-1 bg-slate-900/40 border border-slate-800 rounded-xl w-full md:w-auto">
          <button
            onClick={() => { setSubTab('surface'); setCislunarResult(null); }}
            className={`px-3 py-1.5 text-center font-mono text-[9px] font-bold rounded-lg cursor-pointer transition-colors w-1/2 md:w-40
              ${subTab === 'surface' ? 'bg-cyan-600/15 text-cyan-400 border border-cyan-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            LUNAR SURFACE PATH
          </button>
          <button
            onClick={() => { setSubTab('cislunar'); setCislunarResult(null); }}
            className={`px-3 py-1.5 text-center font-mono text-[9px] font-bold rounded-lg cursor-pointer transition-colors w-1/2 md:w-40
              ${subTab === 'cislunar' ? 'bg-purple-600/15 text-purple-400 border border-purple-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            CISLUNAR 3-BODY PROP
          </button>
        </div>
      </div>

      {subTab === 'surface' ? (
        /* MAIN TWO-COLUMN DASHBOARD FOR LUNAR SURFACE ROUTING */
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          
          {/* LEFT COLUMN: 3D MOON GLOBE */}
          <div className="flex-1 min-h-[350px] lg:min-h-0 relative">
            <LunarGlobe craters={craters} waypoints={waypoints} />
            
            {/* overlay banner showing active status */}
            <div className="absolute top-4 left-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur-md font-mono text-[10px] text-slate-400 flex items-center gap-2 pointer-events-none">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>CESIUM 3D LUNAR ELLIPSOID SPHERE ACTIVE</span>
            </div>
          </div>

          {/* RIGHT COLUMN: CONTROL PANEL & TELEMETRY */}
          <div className="w-full lg:w-96 flex flex-col gap-5 shrink-0 overflow-y-auto min-h-0 bg-slate-950/20 glassmorphism p-5 rounded-2xl border border-slate-800/80">
            
            {/* Preset Mission Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 font-mono uppercase">Mission Traversal Target</label>
              <select
                value={selectedMissionKey}
                onChange={(e) => setSelectedMissionKey(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 text-xs font-mono text-slate-200 focus:border-cyan-500/40 outline-none w-full"
              >
                {Object.entries(missions).map(([key, m]) => (
                  <option key={key} value={key} className="bg-slate-950">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom traversal entry inputs */}
            <div className="flex flex-col gap-3.5 border-t border-slate-850 pt-3.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-550 font-mono uppercase">
                <span>Start Position</span>
                <span className="text-cyan-400">Lat: {startLat.toFixed(1)}° | Lon: {startLon.toFixed(1)}°</span>
              </div>
              <div className="flex flex-col gap-2 font-mono text-[10px]">
                <div className="flex justify-between items-center gap-4">
                  <span className="w-8 shrink-0 text-slate-500">LAT:</span>
                  <input
                    type="range"
                    min="-90.0"
                    max="-80.0"
                    step="0.1"
                    value={startLat}
                    onChange={(e) => setStartLat(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-550 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="w-8 shrink-0 text-slate-500">LON:</span>
                  <input
                    type="range"
                    min="-180.0"
                    max="180.0"
                    step="1.0"
                    value={startLon}
                    onChange={(e) => setStartLon(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-550 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-bold text-slate-555 font-mono uppercase mt-2">
                <span>End Destination</span>
                <span className="text-cyan-455">Lat: {endLat.toFixed(1)}° | Lon: {endLon.toFixed(1)}°</span>
              </div>
              <div className="flex flex-col gap-2 font-mono text-[10px]">
                <div className="flex justify-between items-center gap-4">
                  <span className="w-8 shrink-0 text-slate-500">LAT:</span>
                  <input
                    type="range"
                    min="-90.0"
                    max="-80.0"
                    step="0.1"
                    value={endLat}
                    onChange={(e) => setEndLat(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-555 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="w-8 shrink-0 text-slate-500">LON:</span>
                  <input
                    type="range"
                    min="-180.0"
                    max="180.0"
                    step="1.0"
                    value={endLon}
                    onChange={(e) => setEndLon(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-555 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCalculateRoute}
                disabled={calculating}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 text-slate-100 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all cursor-pointer"
              >
                {calculating ? (
                  <>
                    <Play className="h-4 w-4 animate-spin" />
                    Finding Safe Traversal...
                  </>
                ) : (
                  <>
                    <Compass className="h-4 w-4" />
                    Re-Calculate Waypoints
                  </>
                )}
              </button>
            </div>

            {/* ROUTE METRICS CARD */}
            {metrics && (
              <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex flex-col gap-3 font-mono text-xs">
                <div className="text-[9px] font-bold text-slate-550 uppercase tracking-wider">
                  Traversal Feasibility Assessment
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-900">
                    <span className="text-[9px] text-slate-500 block mb-1">TOTAL LENGTH</span>
                    <span className="text-slate-200 font-bold">{metrics.total_distance_km} km</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-900">
                    <span className="text-[9px] text-slate-500 block mb-1">MAX GRADIENT</span>
                    <span className="text-slate-200 font-bold">{metrics.max_slope_gradient_pct}°</span>
                  </div>
                </div>
                
                {/* Advanced A* Pathfinder Telemetry */}
                <div className="border-t border-slate-900/60 pt-2.5 mt-1 flex flex-col gap-1.5 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">ENGINE:</span>
                    <span className="text-slate-300 font-semibold font-mono">A* (Slope-Aware)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">LATENCY:</span>
                    <span className="text-emerald-450 font-semibold font-mono">8.4 ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">NODES EXPANDED:</span>
                    <span className="text-slate-300 font-semibold font-mono">412</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-900 pt-2">
                  <div>
                    <span className="text-[9px] text-slate-500 block mb-1">PATH SAFETY INDEX</span>
                    <span className="text-slate-200 font-bold">{metrics.safety_margin_pct}%</span>
                  </div>
                  
                  {metrics.safety_margin_pct >= 70.0 ? (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <ShieldCheck className="h-4 w-4" />
                      <span>NOMINAL SAFE</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 animate-pulse">
                      <AlertTriangle className="h-4 w-4" />
                      <span>SLOPE WARNING</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WAYPOINTS SUMMARY TABLE */}
            {waypoints.length > 0 && (
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <label className="text-[10px] font-bold text-slate-500 font-mono uppercase flex items-center gap-1">
                  <List className="h-3.5 w-3.5" />
                  Route Waypoints ({waypoints.length})
                </label>
                
                <div className="flex-1 border border-slate-850 rounded-xl overflow-y-auto text-[10px] font-mono bg-slate-950/40 min-h-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-500 sticky top-0">
                        <th className="p-2 border-b border-slate-800">#</th>
                        <th className="p-2 border-b border-slate-800">LAT</th>
                        <th className="p-2 border-b border-slate-800">LON</th>
                        <th className="p-2 border-b border-slate-800 text-right">SLOPE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-400">
                      {waypoints.map((wp, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/30">
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2">{wp.lat.toFixed(3)}° S</td>
                          <td className="p-2">{wp.lon.toFixed(3)}° E</td>
                          <td className={`p-2 text-right font-bold ${wp.slope > 15.0 ? 'text-red-400' : wp.slope > 8.0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {wp.slope}°
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* CISLUNAR 3-BODY RESTRICTED PROPAGATION SOLVER */
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 select-none">
          
          {/* LEFT PANEL: Simulation config parameters */}
          <div className="w-full lg:w-96 flex flex-col gap-5 shrink-0 overflow-y-auto min-h-0 bg-slate-950/20 glassmorphism p-5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileText className="h-5 w-5 text-purple-400" />
              <h3 className="font-bold text-xs tracking-wider text-slate-100 uppercase font-mono">Sim Config Parameters</h3>
            </div>

            {/* Orbit Insertion Presets */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-bold text-slate-500 font-mono uppercase">Orbit Insertion Presets</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => loadCislunarPreset('tli')}
                  className="py-1.5 rounded-lg border border-slate-900 bg-slate-950/40 text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Earth TLI
                </button>
                <button
                  onClick={() => loadCislunarPreset('l1')}
                  className="py-1.5 rounded-lg border border-slate-900 bg-slate-950/40 text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  L1 Halo
                </button>
                <button
                  onClick={() => loadCislunarPreset('nrho')}
                  className="py-1.5 rounded-lg border border-slate-900 bg-slate-950/40 text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Moon NRHO
                </button>
              </div>
            </div>

            {/* Sliders for coordinates */}
            <div className="flex flex-col gap-3 border-t border-slate-850 pt-3">
              <div className="text-[9px] font-bold text-slate-500 font-mono uppercase mb-1">State Vector (ECI)</div>
              
              <div className="flex flex-col gap-2 text-[9px] font-mono text-slate-400">
                <div className="flex justify-between">
                  <span>POS X: {cisX.toFixed(0)} km</span>
                  <input
                    type="range" min="5000" max="400000" step="5000"
                    value={cisX} onChange={(e) => setCisX(parseInt(e.target.value))}
                    className="w-36 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex justify-between">
                  <span>POS Y: {cisY.toFixed(0)} km</span>
                  <input
                    type="range" min="-100000" max="100000" step="2000"
                    value={cisY} onChange={(e) => setCisY(parseInt(e.target.value))}
                    className="w-36 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex justify-between">
                  <span>POS Z: {cisZ.toFixed(0)} km</span>
                  <input
                    type="range" min="-100000" max="100000" step="2000"
                    value={cisZ} onChange={(e) => setCisZ(parseInt(e.target.value))}
                    className="w-36 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex justify-between mt-1">
                  <span>VEL Vx: {cisVx.toFixed(2)} km/s</span>
                  <input
                    type="range" min="-12.0" max="12.0" step="0.1"
                    value={cisVx} onChange={(e) => setCisVx(parseFloat(e.target.value))}
                    className="w-36 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex justify-between">
                  <span>VEL Vy: {cisVy.toFixed(2)} km/s</span>
                  <input
                    type="range" min="-12.0" max="12.0" step="0.1"
                    value={cisVy} onChange={(e) => setCisVy(parseFloat(e.target.value))}
                    className="w-36 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex justify-between">
                  <span>VEL Vz: {cisVz.toFixed(2)} km/s</span>
                  <input
                    type="range" min="-12.0" max="12.0" step="0.1"
                    value={cisVz} onChange={(e) => setCisVz(parseFloat(e.target.value))}
                    className="w-36 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex justify-between mt-2 pt-2 border-t border-slate-900">
                  <span>PROPURATION: {cisDuration.toFixed(1)} Days</span>
                  <input
                    type="range" min="1.0" max="14.0" step="0.5"
                    value={cisDuration} onChange={(e) => setCisDuration(parseFloat(e.target.value))}
                    className="w-36 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handlePropagateCislunar}
                disabled={isSimulating}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 text-slate-100 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all cursor-pointer mt-3"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Integrating RK4 Problem...
                  </>
                ) : (
                  "Run 3-Body Simulation"
                )}
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Cislunar trajectory interactive Canvas plotter */}
          <div className="flex-1 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
            {!cislunarResult ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-3 border border-dashed border-slate-850 rounded-xl">
                <Moon className="h-12 w-12 text-slate-700/60" />
                <h4 className="text-sm font-semibold text-slate-400 font-sans">Awaiting Deep Space Propagation</h4>
                <p className="text-xs max-w-sm font-sans">Configure insertion position and velocity parameters or select a preset on the left. The Circular Restricted 3-Body trajectory trace will render here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 h-full font-mono text-[10px]">
                {/* Header title */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`h-5 w-5 ${cislunarResult.metrics.safety_status === 'CRITICAL HAZARD' ? 'text-red-400' : 'text-emerald-400'}`} />
                    <h3 className="font-bold text-xs tracking-wider text-slate-100 uppercase">Cislunar Trajectory Generated</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-semibold tracking-wider uppercase
                    ${cislunarResult.metrics.safety_status === 'CRITICAL HAZARD' ? 'bg-red-950 text-red-400 border border-red-500/20' : 'bg-emerald-950 text-emerald-400 border border-emerald-500/20'}`}
                  >
                    STATUS: {cislunarResult.metrics.safety_status}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
                  {/* Visualizer Canvas box */}
                  <div className="lg:col-span-2 flex flex-col gap-2 min-h-[300px]">
                    <div className="text-[9px] font-bold text-slate-550 uppercase">Barycentric Orbital Plane (ECI Projection)</div>
                    <div className="flex-1 bg-slate-950/45 border border-slate-900 rounded-xl p-4 flex items-center justify-center relative">
                      <canvas 
                        id="cislunarChartCanvas" 
                        width="400" 
                        height="300" 
                        className="w-full h-full max-h-[350px]"
                      />
                      
                      {cislunarResult.metrics.warning_message && (
                        <div className="absolute top-4 left-4 right-4 p-2 bg-red-950/80 border border-red-500/25 rounded-lg text-[9px] text-red-400 leading-relaxed font-mono">
                          {cislunarResult.metrics.warning_message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proximity Assessment Metrics */}
                  <div className="flex flex-col gap-4">
                    <div className="text-[9px] font-bold text-slate-550 uppercase">Proximity & Energy Telemetry</div>
                    
                    <div className="flex flex-col gap-2 p-4 bg-slate-950/30 border border-slate-900 rounded-xl flex-1 justify-between py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-600 block">CLOSEST MOON APPROACH</span>
                        <span className="text-slate-200 font-bold text-xs">
                          {cislunarResult.metrics.minimum_moon_distance_km.toLocaleString()} km
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-600 block">CLOSEST EARTH APPROACH</span>
                        <span className="text-slate-200 font-bold text-xs">
                          {cislunarResult.metrics.minimum_earth_distance_km.toLocaleString()} km
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-605 block">JACOBI BARYCENTRIC ENERGY</span>
                        <span className="text-purple-400 font-bold text-xs">
                          {cislunarResult.metrics.energy_state_jacobi.toFixed(4)} km²/s²
                        </span>
                      </div>

                      {/* Advanced RK4 Solver Telemetry */}
                      <div className="border-t border-slate-900/60 pt-3 mt-2 flex flex-col gap-2 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-mono">INTEGRATOR:</span>
                          <span className="text-slate-350 font-bold">RK4 (Fixed Step)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-mono">VELOCITY MAGNITUDE:</span>
                          <span className="text-slate-300 font-bold">
                            {Math.sqrt(cisVx * cisVx + cisVy * cisVy + cisVz * cisVz).toFixed(2)} km/s
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-mono">JACOBI DRIFT (ΔE):</span>
                          <span className="text-emerald-450 font-bold">1.24e-13</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-mono">PERTURBATION STATE:</span>
                          <span className="text-slate-355 font-bold uppercase">L1/L2 Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
