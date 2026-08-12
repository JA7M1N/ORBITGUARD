import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { LunarGlobe } from '../components/LunarGlobe';
import { Play, Compass, Navigation, ShieldCheck, AlertTriangle, List, Moon } from 'lucide-react';

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

  const [loading, setLoading] = useState<boolean>(false);
  const [calculating, setCalculating] = useState<boolean>(false);

  // 1. Fetch initial polar craters list and mission presets
  useEffect(() => {
    const fetchHazards = async () => {
      setLoading(true);
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
      } finally {
        setLoading(false);
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
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-120px)] overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Moon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 tracking-wide uppercase font-mono flex items-center gap-2">
              <span>Lunar South Pole Safety & Pathfinder</span>
              <span className="text-[8px] font-sans font-bold px-1.5 py-0.5 rounded bg-cyan-500 text-white animate-pulse">
                CHANDRAYAAN-2
              </span>
            </h3>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
              <span>Polar Orbit Mapping & Traversal Assessment</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN DASHBOARD */}
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

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-500 font-mono uppercase">Start Lat (S)</label>
              <input
                type="number"
                step="0.01"
                value={startLat}
                onChange={(e) => setStartLat(parseFloat(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/40 text-xs font-mono text-slate-300 outline-none focus:border-cyan-500/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-500 font-mono uppercase">Start Lon (E)</label>
              <input
                type="number"
                step="0.01"
                value={startLon}
                onChange={(e) => setStartLon(parseFloat(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/40 text-xs font-mono text-slate-300 outline-none focus:border-cyan-500/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-500 font-mono uppercase">Target Lat (S)</label>
              <input
                type="number"
                step="0.01"
                value={endLat}
                onChange={(e) => setEndLat(parseFloat(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/40 text-xs font-mono text-slate-300 outline-none focus:border-cyan-500/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-500 font-mono uppercase">Target Lon (E)</label>
              <input
                type="number"
                step="0.01"
                value={endLon}
                onChange={(e) => setEndLon(parseFloat(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/40 text-xs font-mono text-slate-300 outline-none focus:border-cyan-500/20"
              />
            </div>
          </div>

          <button
            onClick={handleCalculateRoute}
            disabled={calculating}
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white font-mono text-xs font-bold tracking-wide transition flex items-center justify-center gap-2"
          >
            <Play className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? "COMPUTING OPTIMAL TRAJECTORY..." : "CALCULATE TRAVERSAL ROUTE"}
          </button>

          {/* TELEMETRY RESULTS */}
          {metrics && (
            <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 flex flex-col gap-3 font-mono">
              <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-cyan-400" />
                Traversal Path Telemetry
              </p>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/40">
                  <span className="text-[9px] text-slate-500 block mb-1">TOTAL LENGTH</span>
                  <span className="text-slate-200 font-bold">{metrics.total_distance_km} km</span>
                </div>
                
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/40">
                  <span className="text-[9px] text-slate-500 block mb-1">MAX GRADIENT</span>
                  <span className={`font-bold ${metrics.max_slope_gradient_pct > 15.0 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {metrics.max_slope_gradient_pct}°
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/40 flex items-center justify-between text-xs">
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
                        <td className={`p-2 text-right ${wp.slope > 15.0 ? 'text-amber-400' : 'text-slate-400'}`}>
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

    </div>
  );
};
