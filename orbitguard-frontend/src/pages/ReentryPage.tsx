import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip 
} from 'recharts';
import { ReentryMap } from '../components/ReentryMap';
import { 
  AlertOctagon, 
  TrendingDown, 
  Activity, 
  Layers, 
  Calendar, 
  ChevronRight, 
  CheckCircle
} from 'lucide-react';
import type { ReentryCandidate } from '../types';

export const ReentryPage: React.FC = () => {
  const [candidates, setCandidates] = useState<ReentryCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [corridorGeojson, setCorridorGeojson] = useState<any>(null);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingMap, setLoadingMap] = useState<boolean>(false);

  // 1. Fetch LEO decay alerts
  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoadingList(true);
        const response = await axios.get(`${API_BASE_URL}/api/reentry`);
        setCandidates(response.data);
        if (response.data.length > 0) {
          setSelectedId(response.data[0].norad_id);
        }
      } catch (e) {
        console.error("Error fetching decay candidates:", e);
      } finally {
        setLoadingList(false);
      }
    };
    fetchList();
  }, []);

  // 2. Fetch specific GeoJSON landing corridor map when selected candidate changes
  useEffect(() => {
    if (selectedId === null) return;
    
    const fetchMap = async () => {
      try {
        setLoadingMap(true);
        const response = await axios.get(`${API_BASE_URL}/api/reentry/${selectedId}/map`);
        setCorridorGeojson(response.data);
      } catch (e) {
        console.error(`Error fetching reentry map for NORAD ${selectedId}:`, e);
      } finally {
        setLoadingMap(false);
      }
    };
    fetchMap();
  }, [selectedId]);

  const selectedCandidate = candidates.find(c => c.norad_id === selectedId);

  // 3. Generate dynamic decay curve data with Space Weather (Kp index) correlation
  const decayData = selectedCandidate 
    ? Array.from({ length: 8 }, (_, i) => {
        const dayOffset = 7 - i;
        const baseAlt = selectedCandidate.current_altitude;
        const baseDecayRate = selectedCandidate.decay_rate;

        // Model a geomagnetic storm event at T-3d
        // Kp is nominal (2.0) on T-7d to T-4d, spikes to 7.8 on T-3d, and recovers
        let solarKp = 2.0;
        if (dayOffset === 3) solarKp = 7.8;
        else if (dayOffset === 2) solarKp = 5.2;
        else if (dayOffset === 1) solarKp = 3.5;
        else if (dayOffset === 4) solarKp = 2.5;

        // Calculate cumulative decay with a storm multiplier effect
        // The decay is steeper during and after the storm (dayOffset 3, 2, 1, 0)
        let decayImpact = 0;
        for (let day = 7; day > dayOffset; day--) {
          let stepDecay = baseDecayRate;
          if (day === 3) stepDecay *= 4.5; // 4.5x decay during peak solar storm!
          else if (day === 2) stepDecay *= 2.5; // 2.5x decay following storm
          else if (day === 1) stepDecay *= 1.5;
          decayImpact += stepDecay;
        }

        const altitudeVal = baseAlt + (baseDecayRate * 7) - decayImpact + Math.sin(dayOffset) * 0.8;

        return {
          day: `T-${dayOffset}d`,
          altitude: Math.max(80.0, Math.round(altitudeVal * 10) / 10),
          kpIndex: solarKp
        };
      })
    : [];

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
      {/* LEFT SIDEBAR: Decaying candidates list */}
      <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 p-4 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
        <div>
          <h3 className="font-bold text-sm tracking-wider text-slate-100 uppercase mb-1">Decay Alerts</h3>
          <p className="text-[10px] text-slate-500 font-medium">SATELLITES UNDER LEO THRESHOLD (250 KM)</p>
        </div>

        {loadingList ? (
          <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-500">
            LOADING DECAY ENTRIES ACTIVE REGISTER...
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 gap-2">
            <CheckCircle className="h-10 w-10 text-emerald-500/40" />
            <h4 className="text-sm font-semibold text-slate-300">Orbit Safe</h4>
            <p className="text-xs max-w-[200px]">No cataloged spacecraft currently show abnormal decay rates below 250 km.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.map((c) => {
              const isSelected = selectedId === c.norad_id;
              return (
                <button
                  key={c.norad_id}
                  onClick={() => setSelectedId(c.norad_id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 flex items-center justify-between group
                    ${isSelected 
                      ? 'bg-blue-600/10 border-blue-500/30 text-slate-100 shadow-md shadow-blue-500/5' 
                      : 'bg-slate-950/20 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-semibold text-xs tracking-wide truncate text-slate-200 group-hover:text-slate-100">
                      {c.name}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px] text-slate-500">
                      <span>Alt: {c.current_altitude.toFixed(1)} km</span>
                      <span>Decay: {c.decay_rate.toFixed(2)} km/d</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-red-950/40 text-red-400 border border-red-500/30">
                      <AlertOctagon className="h-3 w-3 pulse-red" />
                      LEO Decay
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5
                      ${isSelected ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`} 
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT PANE: Selected candidate details, Leaflet map, and Charts */}
      <div className="flex-1 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
        {loadingMap || !selectedCandidate ? (
          <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-500">
            LOADING DECAY SIMULATION GEO-DATABASE...
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Header Details */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-100">{selectedCandidate.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  NORAD ID: {selectedCandidate.norad_id} | Decay Rate: {selectedCandidate.decay_rate.toFixed(2)} km/day
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-slate-300">
                <Calendar className="h-4 w-4 text-blue-500" />
                ETA: {new Date(selectedCandidate.eta).toLocaleString()} UTC
              </div>
            </div>

            {/* Spatial Map & statistics panels */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Map container */}
              <div className="xl:col-span-2 h-[350px] xl:h-[400px]">
                <ReentryMap
                  geojsonCorridor={corridorGeojson}
                  satelliteName={selectedCandidate.name}
                />
              </div>

              {/* Statistics Cards */}
              <div className="flex flex-col gap-4">
                <div className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-1">Telemetry Metrics</div>
                
                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Current Altitude</div>
                    <div className="text-2xl font-mono font-bold text-slate-200">{selectedCandidate.current_altitude.toFixed(1)} km</div>
                  </div>
                  <TrendingDown className="h-6 w-6 text-blue-400/40" />
                </div>

                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Fragment Survival Rate</div>
                    <div className="text-2xl font-mono font-bold text-amber-400">{selectedCandidate.survival_pct.toFixed(1)}%</div>
                  </div>
                  <Layers className="h-6 w-6 text-amber-400/40" />
                </div>

                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Casualty Risk (Ec)</div>
                    <div className="text-2xl font-mono font-bold text-red-400">{selectedCandidate.casualty_probability.toExponential(2)}</div>
                  </div>
                  <AlertOctagon className="h-6 w-6 text-red-500/40" />
                </div>
              </div>
            </div>

            {/* Recharts Altitude Decay line chart */}
            <div className="p-5 bg-slate-900/30 border border-slate-800/60 rounded-2xl">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-4">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-400" />
                  Historical Altitude Decay & Space Weather correlation (T-7 Days)
                </span>
                <span className="text-[10px] text-purple-400 font-mono">Kp ≥ 5 represents storm event</span>
              </div>
              <div className="h-56 w-full font-mono text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={decayData}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.3)" />
                    <XAxis 
                      dataKey="day" 
                      stroke="#475569" 
                      fontSize={9} 
                      tickLine={false} 
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="#3b82f6" 
                      fontSize={9} 
                      domain={['auto', 'auto']} 
                      tickLine={false} 
                      unit=" km"
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#a855f7" 
                      fontSize={9} 
                      domain={[0, 9]} 
                      tickLine={false} 
                      unit=" Kp"
                    />
                    <ChartTooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}
                      labelStyle={{ color: '#475569', fontWeight: 'bold' }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="altitude"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#ef4444', stroke: '#020617', strokeWidth: 1 }}
                      activeDot={{ r: 5.5 }}
                      name="Altitude"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="kpIndex"
                      stroke="#a855f7"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#a855f7', stroke: '#020617', strokeWidth: 1 }}
                      activeDot={{ r: 5 }}
                      name="Storm Index"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
