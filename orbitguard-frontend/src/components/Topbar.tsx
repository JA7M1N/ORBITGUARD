import React, { useState, useEffect } from 'react';
import { Shield, Clock, AlertTriangle } from 'lucide-react';

interface TopbarProps {
  criticalAlerts?: string[];
  onToggleSim?: () => void;
  isSimActive?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ 
  criticalAlerts = [
    "CRITICAL CONJUNCTION DETECTED: NORAD 25544 (ISS) vs NORAD 900 (CALSPHERE 1) - Pc: 1.2e-04 - TCA in T-12 Hours.",
    "SPACE WEATHER WARNING: Severe Coronal Mass Ejection detected. Solar flux index F10.7 spike expected to exceed 220 sfu.",
    "REENTRY UPDATE: CALSPHERE 1 (NORAD 900) altitude dropped below LEO baseline (130.0 km). Landing corridor projected."
  ],
  onToggleSim,
  isSimActive = false
}) => {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      const seconds = String(d.getUTCSeconds()).padStart(2, '0');
      
      setUtcTime(`${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glassmorphism w-full sticky top-0 z-50 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800">
      {/* Brand Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30 flex items-center justify-center">
          <Shield className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wider text-slate-100 flex items-center gap-2">
            ORBITGUARD
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">SSA & SPACE SAFETY OPERATIONS</p>
        </div>
      </div>

      {/* Scrolling Critical Alerts Banner */}
      <div className="flex-1 max-w-xl md:max-w-2xl bg-red-950/20 border border-red-500/20 rounded-full py-1.5 px-4 overflow-hidden relative flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs uppercase tracking-wider z-10 bg-slate-950/80 px-2 py-0.5 rounded-full border border-red-500/30 shrink-0">
          <AlertTriangle className="h-3.5 w-3.5" />
          Alerts
        </div>
        <div className="w-full relative overflow-hidden flex items-center">
          <div className="whitespace-nowrap flex gap-12 text-xs font-medium text-slate-300 animate-marquee hover:cursor-pointer">
            {criticalAlerts.map((alert, index) => (
              <span key={index} className="flex items-center gap-2">
                <span>•</span> {alert}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Controls & UTC Mission Clock */}
      <div className="flex items-center gap-2">
        {onToggleSim && (
          <button
            onClick={onToggleSim}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase transition-all duration-300 border
              ${isSimActive 
                ? 'bg-red-600/10 border-red-500/30 text-red-400 hover:bg-red-900/20' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
          >
            <AlertTriangle className={`h-3.5 w-3.5 ${isSimActive ? 'animate-bounce text-red-400' : 'text-slate-500'}`} />
            {isSimActive ? "Sim Active" : "Sim Storm"}
          </button>
        )}

        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2 font-mono text-sm text-blue-400 tracking-wider">
          <Clock className="h-4 w-4 shrink-0 text-blue-500" />
          {utcTime || "LOADING CLOCK..."}
        </div>
      </div>
    </header>
  );
};
