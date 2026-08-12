import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart,
  Line,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip,
  Legend
} from 'recharts';
import { Sun, Shield, Gauge, Activity, Info, Zap, AlertTriangle, Timer, Flame, RefreshCw } from 'lucide-react';

interface WeatherHistorical {
  date: string;
  f10_7: number;
  ap: number;
}

interface WeatherResponse {
  f10_7: number;
  ap: number;
  drag_scaler: number;
  historical: WeatherHistorical[];
}

export const SolarWeatherPage: React.FC = () => {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Aditya-L1 Real-Time States
  const [adityaData, setAdityaData] = useState<any>(null);
  const [adityaHistory, setAdityaHistory] = useState<any[]>([]);
  const [atRiskSats, setAtRiskSats] = useState<any[]>([]);
  const [triggering, setTriggering] = useState<string | null>(null);

  // 1. Fetch initial observed NOAA weather indices from backend
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/api/solar`);
        setData(response.data);
      } catch (e) {
        console.error("Error fetching solar weather indices:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, []);

  // 2. Poll Aditya-L1 real-time telemetry every 2 seconds
  useEffect(() => {
    const fetchAdityaTelemetry = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/solar/aditya-l1`);
        const aData = response.data;
        setAdityaData(aData);

        // Update cards dynamically so the base values sync with the active storm
        setData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            f10_7: aData.f10_7,
            ap: aData.ap,
            drag_scaler: aData.f10_7 / 70.0
          };
        });

        // Add to live telemetry chart history (keep last 25 ticks)
        setAdityaHistory(prev => {
          const timestampLabel = new Date(aData.timestamp * 1000).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          const next = [...prev, {
            time: timestampLabel,
            solexs: aData.solexs_flux,
            hel1os: aData.hel1os_flux
          }];
          if (next.length > 25) {
            next.shift();
          }
          return next;
        });

        // Fetch at-risk satellites
        const reentryRes = await axios.get(`${API_BASE_URL}/api/reentry`);
        setAtRiskSats(reentryRes.data);
      } catch (e) {
        console.error("Error polling Aditya-L1 data:", e);
      }
    };

    fetchAdityaTelemetry();
    const interval = setInterval(fetchAdityaTelemetry, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerFlare = async (flareClass: string) => {
    try {
      setTriggering(flareClass);
      await axios.post(`${API_BASE_URL}/api/solar/trigger-flare/${flareClass}`);
    } catch (e) {
      console.error("Error triggering flare:", e);
    } finally {
      setTriggering(null);
    }
  };

  const handleClearFlare = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/solar/clear-flare`);
    } catch (e) {
      console.error("Error clearing flare:", e);
    }
  };

  if (loading || !data) {
    return (
      <div className="w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] flex items-center justify-center font-mono text-xs text-slate-500">
        FETCHING OBSERVED NOAA SOLAR SPACE WEATHER INDICES...
      </div>
    );
  }

  // Format historical date strings for chart display (e.g. "2026-08-06" -> "08/06")
  const chartData = data.historical.map(h => ({
    ...h,
    label: h.date.substring(5).replace('-', '/')
  }));

  const getGeomagneticStatus = (ap: number) => {
    if (ap >= 50) return { label: "Severe Storm", color: "text-red-400 border-red-500/20 bg-red-950/40" };
    if (ap >= 30) return { label: "Geomagnetic Storm", color: "text-amber-400 border-amber-500/20 bg-amber-950/40" };
    if (ap >= 15) return { label: "Active Disturbance", color: "text-blue-400 border-blue-500/20 bg-blue-950/40" };
    return { label: "Quiet Conditions", color: "text-emerald-400 border-emerald-500/20 bg-emerald-950/40" };
  };

  const geoStatus = getGeomagneticStatus(data.ap);
  const activeEvent = adityaData?.active_event;

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] overflow-y-auto pr-1">
      
      {/* 1. TOP METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0">
        {/* Card 1: F10.7 Solar Flux */}
        <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80 flex items-center justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.06),transparent_60%)]"></div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              Observed Solar Flux
            </div>
            <div className="text-3xl font-mono font-bold text-slate-200">{data.f10_7.toFixed(1)}</div>
            <div className="text-[10px] font-mono text-amber-400/80 mt-1 font-semibold">SFU (Solar Flux Units)</div>
          </div>
          <div className="shrink-0 h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform duration-300">
            <Sun className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        {/* Card 2: Ap Geomagnetic Index */}
        <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80 flex items-center justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.06),transparent_60%)]"></div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-500" />
              Geomagnetic Ap Index
            </div>
            <div className="text-3xl font-mono font-bold text-slate-200">{data.ap.toFixed(1)}</div>
            <span className={`inline-block text-[9px] font-bold font-mono px-2 py-0.5 rounded-full border mt-1.5 ${geoStatus.color}`}>
              {geoStatus.label}
            </span>
          </div>
          <div className="shrink-0 h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform duration-300">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Dynamic Drag Scaler */}
        <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80 flex items-center justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.06),transparent_60%)]"></div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-emerald-500" />
              Decay Drag Scaler
            </div>
            <div className="text-3xl font-mono font-bold text-slate-200">{data.drag_scaler.toFixed(2)}x</div>
            <div className="text-[10px] font-mono text-emerald-400/80 mt-1 font-semibold">Density lookup multiplier</div>
          </div>
          <div className="shrink-0 h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform duration-300">
            <Gauge className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. ADITYA-L1 CME WARNING BANNER */}
      {activeEvent && (
        <div className={`p-5 rounded-2xl border shrink-0 relative overflow-hidden animate-pulse ${
          activeEvent.impact_active 
            ? "bg-red-950/40 border-red-500/30 text-red-200" 
            : "bg-amber-950/40 border-amber-500/30 text-amber-200"
        }`}>
          <div className="absolute top-0 right-0 h-32 w-32 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1),transparent_70%)] pointer-events-none"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl border mt-0.5 ${
                activeEvent.impact_active 
                  ? "bg-red-500/10 border-red-500/20 text-red-400" 
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}>
                {activeEvent.impact_active ? <AlertTriangle className="h-6 w-6" /> : <Timer className="h-6 w-6" />}
              </div>
              <div>
                <h4 className="text-sm font-bold font-mono tracking-wider flex items-center gap-2">
                  <span>ADITYA-L1 FORECAST: {activeEvent.flare_class}-CLASS SOLAR FLARE DETECTED</span>
                  {activeEvent.impact_active && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-500 text-white rounded font-sans animate-bounce uppercase">
                      Storm Active
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  {activeEvent.impact_active 
                    ? `CME impact occurred. Geomagnetic storm active. Thermospheric density swelled (F10.7 +${activeEvent.f10_7_increase}, Ap +${activeEvent.ap_increase}).`
                    : `Coronal Mass Ejection launched at ${activeEvent.cme_speed.toFixed(0)} km/s. In-transit across inner solar system.`
                  }
                </p>
                
                {/* CME progress bar */}
                {!activeEvent.impact_active && (
                  <div className="mt-3 w-72 md:w-96 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>Sun (0.0 AU)</span>
                      <span>Progress: {(activeEvent.cme_progress_pct * 100).toFixed(0)}%</span>
                      <span>Earth (1.0 AU)</span>
                    </div>
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${activeEvent.cme_progress_pct * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Live Timer or clear button */}
            <div className="shrink-0 flex flex-col md:items-end font-mono text-xs">
              {!activeEvent.impact_active ? (
                <>
                  <div className="text-slate-500 flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" />
                    Demo Impact ETA
                  </div>
                  <div className="text-xl font-bold text-amber-400 mt-1">{activeEvent.demo_eta_seconds.toFixed(0)}s</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Real-world ETA: {(activeEvent.real_eta_seconds / 3600).toFixed(1)} hrs</div>
                </>
              ) : (
                <button 
                  onClick={handleClearFlare}
                  className="px-3.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-[10px] uppercase font-bold tracking-widest"
                >
                  Clear Storm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. MIDDLE DUAL SECTION: Telemetry + Controls & Risks */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 shrink-0">
        
        {/* Live Telemetry Chart */}
        <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80 flex flex-col h-[400px]">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Aditya-L1 Live Solar Flare Monitor (SoLEXS & HEL1OS)
            </div>
            <div className="text-[9px] font-mono text-emerald-400/80 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Live Feed
            </div>
          </div>
          
          <div className="flex-1 min-h-0 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={adityaHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.4)" />
                <XAxis dataKey="time" stroke="rgba(71, 85, 105, 0.8)" fontSize={8} tickLine={false} />
                <YAxis yAxisId="left" stroke="rgba(245, 158, 11, 0.8)" fontSize={8} domain={[0, 'auto']} tickLine={false} label={{ value: 'SoLEXS Flux (W/m²)', angle: -90, position: 'insideLeft', offset: 10, fill: '#f59e0b', fontSize: 8 }} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(59, 130, 246, 0.8)" fontSize={8} domain={[0, 'auto']} tickLine={false} label={{ value: 'HEL1OS Counts/s', angle: 90, position: 'insideRight', offset: 10, fill: '#3b82f6', fontSize: 8 }} />
                <ChartTooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontFamily: 'monospace'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace', marginTop: 10 }} />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="solexs" 
                  name="SoLEXS (Soft X-Ray)"
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="hel1os" 
                  name="HEL1OS (Hard X-Ray)"
                  stroke="#3b82f6" 
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Controls & Satellites list */}
        <div className="flex flex-col gap-6 h-[400px]">
          {/* Controls Card */}
          <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80 flex flex-col shrink-0">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Aditya-L1 Simulation Controls
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                disabled={!!activeEvent || !!triggering}
                onClick={() => handleTriggerFlare("C")}
                className="px-4 py-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition font-mono text-[10px] font-bold tracking-wider flex flex-col items-center gap-1"
              >
                <span>C-CLASS</span>
                <span className="text-[8px] font-normal text-slate-500">Minor storm</span>
              </button>
              <button
                disabled={!!activeEvent || !!triggering}
                onClick={() => handleTriggerFlare("M")}
                className="px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition font-mono text-[10px] font-bold tracking-wider flex flex-col items-center gap-1"
              >
                <span>M-CLASS</span>
                <span className="text-[8px] font-normal text-slate-500">Medium storm</span>
              </button>
              <button
                disabled={!!activeEvent || !!triggering}
                onClick={() => handleTriggerFlare("X")}
                className="px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition font-mono text-[10px] font-bold tracking-wider flex flex-col items-center gap-1"
              >
                <span>X-CLASS</span>
                <span className="text-[8px] font-normal text-slate-500">Severe storm</span>
              </button>
            </div>
          </div>

          {/* At-Risk Satellites Card */}
          <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80 flex flex-col flex-1 min-h-0">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-500" />
                Decay Hazards & Storm Drag Vulnerabilities
              </span>
              {activeEvent?.impact_active && (
                <span className="text-[8px] font-bold px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded font-mono">
                  DRAG SURGE SCALING
                </span>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 font-mono text-[10px] text-slate-300">
              {atRiskSats.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  NO ACTIVE REENTRY DECAY CANDIDATES FOUND
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-500">
                      <th className="py-2 font-semibold">SAT NAME</th>
                      <th className="py-2 font-semibold text-right">ALT (km)</th>
                      <th className="py-2 font-semibold text-right">DECAY RATE</th>
                      <th className="py-2 font-semibold text-right">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskSats.map((sat) => {
                      const stormScaler = sat.storm_multiplier || 1.0;
                      const hasSurge = stormScaler > 1.0;
                      const formattedEta = sat.eta ? new Date(sat.eta).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
                      
                      return (
                        <tr key={sat.norad_id} className="border-b border-slate-850 hover:bg-slate-900/20 transition">
                          <td className="py-2.5 font-bold text-slate-200">
                            {sat.name}
                            <span className="block text-[8px] text-slate-500">NORAD {sat.norad_id}</span>
                          </td>
                          <td className="py-2.5 text-right font-semibold">{sat.current_altitude.toFixed(1)}</td>
                          <td className={`py-2.5 text-right font-bold ${hasSurge ? 'text-red-400' : 'text-slate-400'}`}>
                            {sat.decay_rate.toFixed(2)} m/d
                            {hasSurge && (
                              <span className="block text-[8px] text-red-500 font-semibold animate-pulse">
                                +{((stormScaler - 1) * 100).toFixed(0)}% Surge
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right text-slate-400 font-semibold">{formattedEta}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 4. HISTORICAL TRENDS SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 shrink-0">
        {/* Chart A: Solar Flux Area Chart */}
        <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">
            <Activity className="h-4 w-4 text-amber-500" />
            Solar Radio Flux F10.7 Trend (sfu)
          </div>
          <div className="h-64 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorF107" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.4)" />
                <XAxis dataKey="label" stroke="rgba(71, 85, 105, 0.8)" fontSize={9} tickLine={false} />
                <YAxis stroke="rgba(71, 85, 105, 0.8)" fontSize={9} domain={['auto', 'auto']} tickLine={false} />
                <ChartTooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                  labelStyle={{ color: '#475569', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f59e0b' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="f10_7" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorF107)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Geomagnetic Ap Index Bar Chart */}
        <div className="glassmorphism p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">
            <Activity className="h-4 w-4 text-blue-500" />
            Geomagnetic Activity Index Ap Trend
          </div>
          <div className="h-64 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.4)" />
                <XAxis dataKey="label" stroke="rgba(71, 85, 105, 0.8)" fontSize={9} tickLine={false} />
                <YAxis stroke="rgba(71, 85, 105, 0.8)" fontSize={9} domain={[0, 'auto']} tickLine={false} />
                <ChartTooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                  labelStyle={{ color: '#475569', fontWeight: 'bold' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Bar 
                  dataKey="ap" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. PHYSICAL THEORY INFO PANEL */}
      <div className="p-5 bg-slate-900/30 border border-slate-800/60 rounded-2xl shrink-0 flex items-start gap-4 mb-4">
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl mt-1">
          <Info className="h-5 w-5" />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-slate-200 tracking-wide">
            Aditya-L1 Solar Forecast and Geomagnetic Drag Correlation
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">
            {"By leveraging real-time solar X-ray flux telemetry from ISRO's Aditya-L1 spacecraft (using SoLEXS soft X-ray and HEL1OS hard X-ray sensors), OrbitGuard monitors solar activity and predicts Earth-directed Coronal Mass Ejection (CME) launches. When a high-velocity CME impacts Earth's magnetosphere, it drives a major geomagnetic storm, expanding the density of the upper thermosphere. Under active storm conditions, satellite drag parameters spike, accelerating uncontrolled decay rates for LEO space assets."}
          </p>
          <div className="text-[10px] text-slate-500 italic font-mono mt-1">
            Real-time telemetry simulated inspired by the ISRO Aditya-L1 SoLEXS & HEL1OS payloads (BAH 2026 Challenge PS-15).
          </div>
        </div>
      </div>
    </div>
  );
};
