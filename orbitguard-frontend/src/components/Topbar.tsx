import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

interface TopbarProps {
  criticalAlerts?: string[];
  onToggleSim?: () => void;
  isSimActive?: boolean;
  solarMetrics?: { ap: number; f10_7: number; drag_scaler: number } | null;
  trackedCount?: number;
  isTourActive?: boolean;
  onStartTour?: () => void;
  onToggleCheatsheet?: () => void;
  isCheatsheetActive?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ 
  criticalAlerts = [
    "CRITICAL CONJUNCTION DETECTED: NORAD 25544 (ISS) vs NORAD 900 (CALSPHERE 1) - Pc: 1.2e-04 - TCA in T-12 Hours.",
    "SPACE WEATHER WARNING: Severe Coronal Mass Ejection detected. Solar flux index F10.7 spike expected to exceed 220 sfu.",
    "REENTRY UPDATE: CALSPHERE 1 (NORAD 900) altitude dropped below LEO baseline (130.0 km). Landing corridor projected."
  ],
  onToggleSim,
  isSimActive = false,
  solarMetrics,
  trackedCount = 104,
  isTourActive = false,
  onStartTour,
  onToggleCheatsheet,
  isCheatsheetActive = false
}) => {
  const [utcTimeOnly, setUtcTimeOnly] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      const seconds = String(d.getUTCSeconds()).padStart(2, '0');
      
      setUtcTimeOnly(`${hours}:${minutes}:${seconds} UTC`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const apVal = solarMetrics?.ap ?? 7.5;
  const f107Val = solarMetrics?.f10_7 ?? 136.0;
  const dragVal = solarMetrics?.drag_scaler ?? 1.94;
  
  // Convert Ap to Kp index using logarithmic mapping
  const kpVal = apVal <= 0 ? "0.0" : (Math.log(apVal + 1) * 1.5).toFixed(1);

  return (
    <header className="glassmorphism w-full sticky top-0 z-50 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800">
      {/* Brand Logo, Live Badge & UTC Clock */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30 flex items-center justify-center">
          <Shield className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex items-center gap-2.5 font-mono">
          <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
            ORBITGUARD
          </h1>
          <span className="text-slate-800 font-light select-none">|</span>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-green shrink-0"></span>
            LIVE
          </div>
          <span className="text-slate-700 select-none">•</span>
          <span className="text-xs text-slate-350 tracking-wider">
            {utcTimeOnly || "LOADING CLOCK..."}
          </span>
        </div>
      </div>

      {/* Scrolling Critical Alerts Banner */}
      <div className="flex-1 max-w-lg md:max-w-xl bg-red-950/20 border border-red-500/20 rounded-full py-1 px-4 overflow-hidden relative flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-red-400 font-semibold text-[10px] uppercase tracking-wider z-10 bg-slate-950/80 px-2 py-0.5 rounded-full border border-red-500/30 shrink-0 select-none">
          <AlertTriangle className="h-3 w-3" />
          Alerts
        </div>
        <div className="w-full relative overflow-hidden flex items-center">
          <div className="whitespace-nowrap flex gap-12 text-[10px] font-medium text-slate-400 animate-marquee hover:cursor-pointer">
            {criticalAlerts.map((alert, index) => (
              <span key={index} className="flex items-center gap-2">
                <span>•</span> {alert}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Controls & Space Wx Telemetry */}
      <div className="flex items-center gap-4 font-mono select-none">
        {/* Space Wx Badge Panel */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-800/80 bg-slate-950/40 text-[10px] font-bold text-slate-400">
          <span className="text-slate-500 uppercase">SPACE WX:</span>
          <span className="text-amber-400">F10.7 {Math.round(f107Val)}</span>
          <span className="text-slate-700">•</span>
          <span className="text-purple-400">Kp {kpVal}</span>
          <span className="text-slate-700">•</span>
          <span className="text-emerald-400">DRAG {dragVal.toFixed(1)}x</span>
        </div>

        {/* Tracked satellites count */}
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
          <span className="text-slate-500">TRACKED:</span>
          <span className="text-blue-400 font-mono">{trackedCount}</span>
        </div>

        {onStartTour && (
          <button
            onClick={onStartTour}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase transition-all duration-300 border cursor-pointer
              ${isTourActive 
                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse' 
                : 'bg-slate-900/60 border-slate-800 text-blue-400 hover:text-blue-300 hover:bg-slate-800'
              }`}
          >
            <span className={`h-2 w-2 rounded-full ${isTourActive ? 'bg-white animate-ping' : 'bg-blue-400 shrink-0'}`} />
            {isTourActive ? "Tour Active" : "▶ Hackathon Demo Tour"}
          </button>
        )}

        {onToggleSim && (
          <button
            onClick={onToggleSim}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase transition-all duration-300 border cursor-pointer
              ${isSimActive 
                ? 'bg-red-600/10 border-red-500/30 text-red-400 hover:bg-red-900/20' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-350 hover:bg-slate-800'
              }`}
          >
            <AlertTriangle className={`h-3.5 w-3.5 ${isSimActive ? 'animate-bounce text-red-400' : 'text-slate-500'}`} />
            {isSimActive ? "Sim Active" : "Sim Storm"}
          </button>
        )}

        {onToggleCheatsheet && (
          <button
            onClick={onToggleCheatsheet}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase transition-all duration-300 border cursor-pointer
              ${isCheatsheetActive 
                ? 'bg-blue-600/10 border-blue-500/35 text-blue-450 hover:bg-blue-900/20' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-350 hover:bg-slate-800'
              }`}
          >
            <span className={`h-2 w-2 rounded-full ${isCheatsheetActive ? 'bg-blue-450 animate-pulse' : 'bg-slate-500'}`} />
            ℹ Architecture & Q&A
          </button>
        )}
      </div>
    </header>
  );
};
