import React, { useState } from 'react';
import { OrbitGlobe } from '../components/OrbitGlobe';
import { Settings, Eye, Sliders, MapPin, Gauge } from 'lucide-react';

interface OrbitMapPageProps {
  isSimActive?: boolean;
}

export const OrbitMapPage: React.FC<OrbitMapPageProps> = ({ isSimActive = false }) => {
  // Toggle states
  const [showDebris, setShowDebris] = useState<boolean>(true);
  const [showPayloads, setShowPayloads] = useState<boolean>(true);
  const [showSensors, setShowSensors] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  
  // Numerical values
  const [limit, setLimit] = useState<number>(30);
  const [multiplier, setMultiplier] = useState<number>(60); // 60x simulation time speed

  const multipliers = [
    { label: "1x", val: 1 },
    { label: "10x", val: 10 },
    { label: "60x", val: 60 },
    { label: "600x", val: 600 },
    { label: "3600x", val: 3600 }
  ];

  return (
    <div className="flex flex-col xl:flex-row gap-6 w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
      {/* 1. Main 3D Canvas container */}
      <div className="flex-1 min-h-[350px] xl:min-h-0 relative">
        <OrbitGlobe
          limit={limit}
          showDebris={showDebris}
          showPayloads={showPayloads}
          showSensors={showSensors}
          showHeatmap={showHeatmap}
          isSimActive={isSimActive}
          multiplier={multiplier}
        />
      </div>

      {/* 2. Control Panel Sidebar */}
      <div className="w-full xl:w-80 shrink-0 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Settings className="h-5 w-5 text-blue-400" />
          <h3 className="font-bold text-sm tracking-wider text-slate-100 uppercase">Map Controller</h3>
        </div>

        {/* Visibility Toggles */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
            <Eye className="h-3.5 w-3.5" />
            Layer Visibility
          </div>
          
          <label className="flex items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 rounded-xl cursor-pointer transition-colors group">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 pulse-red"></span>
              DEBRIS CLOUD
            </span>
            <input 
              type="checkbox" 
              checked={showDebris} 
              onChange={() => setShowDebris(!showDebris)} 
              className="accent-blue-500 h-4 w-4 border-slate-800 rounded bg-slate-950 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 rounded-xl cursor-pointer transition-colors group">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 pulse-green"></span>
              ACTIVE PAYLOADS
            </span>
            <input 
              type="checkbox" 
              checked={showPayloads} 
              onChange={() => setShowPayloads(!showPayloads)} 
              className="accent-blue-500 h-4 w-4 border-slate-800 rounded bg-slate-950 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 rounded-xl cursor-pointer transition-colors group">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-400" />
              GROUND RADAR SENSORS
            </span>
            <input 
              type="checkbox" 
              checked={showSensors} 
              onChange={() => setShowSensors(!showSensors)} 
              className="accent-blue-500 h-4 w-4 border-slate-800 rounded bg-slate-950 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 rounded-xl cursor-pointer transition-colors group">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-purple-400" />
              ORBITAL HAZARD SHELLS
            </span>
            <input 
              type="checkbox" 
              checked={showHeatmap} 
              onChange={() => setShowHeatmap(!showHeatmap)} 
              className="accent-blue-500 h-4 w-4 border-slate-800 rounded bg-slate-950 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
          </label>
        </div>

        {/* Debris Density count slider */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" />
              Catalog Capacity
            </span>
            <span className="text-blue-400 font-mono">{limit} Objects</span>
          </div>
          <div className="px-1">
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
              <span>5 Sats</span>
              <span>50 Sats</span>
              <span>100 Sats</span>
            </div>
          </div>
        </div>

        {/* Time Propagation Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
            <Gauge className="h-3.5 w-3.5" />
            Propagation Speed
          </div>
          <div className="grid grid-cols-5 gap-1.5 bg-slate-900/60 border border-slate-800/80 p-1 rounded-xl">
            {multipliers.map((m) => (
              <button
                key={m.label}
                onClick={() => setMultiplier(m.val)}
                className={`py-1.5 text-[10px] font-bold font-mono rounded-lg transition-all
                  ${multiplier === m.val 
                    ? 'bg-blue-600 text-slate-100 shadow-md shadow-blue-600/10' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                  }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Legend */}
        <div className="mt-auto p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col gap-2">
          <div className="text-[10px] font-bold text-slate-550 tracking-wider uppercase mb-1">Color Codes</div>
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-400">Operational Satellite</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
            <span className="text-slate-400">Debris Object</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-400">Spent Rocket Body</span>
          </div>
        </div>
      </div>
    </div>
  );
};
