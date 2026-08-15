import React, { useState, useEffect, useRef } from 'react';
import { OrbitGlobe } from '../components/OrbitGlobe';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Film, 
  Sliders, 
  TrendingUp, 
  Activity, 
  Zap,
  X
} from 'lucide-react';

export const SimulationPage: React.FC = () => {
  // Playback States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0.0); // 0.0 to 1.0
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0); // 0.5x, 1x, 2x, 5x
  const [cameraMode, setCameraMode] = useState<'approach' | 'impact' | 'orbit' | 'free'>('approach');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);
  
  // Satellite Mass configs
  const [sat1Mass, setSat1Mass] = useState<number>(560); // Iridium 33
  const [sat2Mass, setSat2Mass] = useState<number>(900); // Cosmos 2251
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Animate the progress loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = now;
      }
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Base animation speed: takes 15 seconds to run the 0.0 -> 1.0 progress loop at 1x speed
      const baseDurationMs = 15000;
      const progressDelta = (deltaMs / baseDurationMs) * speedMultiplier;

      setProgress(prev => {
        const next = prev + progressDelta;
        if (next >= 1.0) {
          setIsPlaying(false);
          return 1.0;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, speedMultiplier]);

  // Adjust camera modes automatically based on phase progress for cinematic effect
  useEffect(() => {
    if (progress < 0.5) {
      setCameraMode('approach');
    } else if (progress >= 0.5 && progress < 0.6) {
      setCameraMode('impact');
    } else if (progress >= 0.6 && cameraMode === 'impact') {
      setCameraMode('orbit');
    }
  }, [progress]);

  // Reset Simulation
  const handleReset = () => {
    setIsPlaying(false);
    setProgress(0.0);
    setCameraMode('approach');
  };

  // Math Calculations derived from progress
  const hasImpacted = progress >= 0.5;
  const approachProgress = Math.min(1.0, progress / 0.5);
  const dispersionProgress = hasImpacted ? (progress - 0.5) / 0.5 : 0;

  // Real-world Relative Velocity: 11.65 km/s = 11,650 m/s
  const relativeSpeedMs = 11650; 
  // Kinetic energy: E = 1/2 * mu * v^2 where mu = (m1 * m2)/(m1 + m2)
  const reducedMass = (sat1Mass * sat2Mass) / (sat1Mass + sat2Mass);
  const kineticEnergyJoules = 0.5 * reducedMass * relativeSpeedMs * relativeSpeedMs;
  const kineticEnergyGigaJoules = kineticEnergyJoules / 1e9;

  // Live countdown or time elapsed
  let timeText = "";
  if (!hasImpacted) {
    const countdownSec = Math.max(0, (5.0 * (1.0 - approachProgress))).toFixed(2);
    timeText = `TCA - ${countdownSec}s`;
  } else {
    const elapsedSec = (25.0 * dispersionProgress).toFixed(2);
    timeText = `TCA + ${elapsedSec}s`;
  }

  // Fragment count (scaled using standard NASA fragmentation models)
  const totalFragmentsMax = 1450;
  const fragmentCount = hasImpacted 
    ? Math.round(totalFragmentsMax * Math.pow(dispersionProgress, 0.4))
    : 0;

  // Debris Cloud Radius (km)
  const cloudRadiusKm = hasImpacted
    ? Number((350.0 * Math.pow(dispersionProgress, 0.6)).toFixed(1))
    : 0.0;

  // Debris sizes table estimations
  const sizeLarge = Math.round(fragmentCount * 0.22); // >10cm
  const sizeMedium = Math.round(fragmentCount * 0.48); // 1-10cm
  const sizeSmall = Math.round(fragmentCount * 0.30); // <1cm

  return (
    <div className="relative w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] overflow-hidden rounded-2xl select-none">
      
      {/* 3D CESIUM GLOBE CONTAINER */}
      <div className={`w-full h-full relative border transition-all duration-350 overflow-hidden
        ${hasImpacted && progress < 0.55 
          ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.25)] animate-pulse' 
          : 'border-slate-800/80'}`}
      >
        <OrbitGlobe
          isCollisionSimMode={true}
          collisionProgress={progress}
          collisionCameraMode={cameraMode}
          showDebris={false}
          showPayloads={false}
          showSensors={false}
          showHeatmap={false}
          multiplier={60}
        />

        {/* Global indicator status overlay (Top-Left) */}
        <div className="absolute top-4 left-4 p-3.5 rounded-xl bg-slate-950/85 border border-slate-850 backdrop-blur-md font-mono text-[10px] text-slate-400 flex flex-col gap-1.5 pointer-events-none z-10">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isPlaying ? 'bg-red-500 animate-ping' : 'bg-slate-650 animate-pulse'}`} />
            <span className="font-bold text-slate-200">KINETIC IMPACT ENGINE v1.2</span>
          </div>
          <div className="text-slate-500 font-medium">IRIDIUM 33 × COSMOS 2251 ENCOUNTER</div>
        </div>

        {/* Floating TCA timer (Bottom-Left) */}
        <div className="absolute bottom-4 left-4 px-4 py-2.5 rounded-xl bg-slate-950/85 border border-slate-850 backdrop-blur-md font-mono text-xs font-bold text-slate-200 pointer-events-none z-10 flex items-center gap-2">
          <Activity className="h-4 w-4 text-red-500" />
          <span>{timeText}</span>
        </div>

        {/* COLLAPSED FLOATING CONTROL BUTTON */}
        {isPanelCollapsed && (
          <button
            onClick={() => setIsPanelCollapsed(false)}
            className="absolute top-4 right-4 z-10 glassmorphism px-4 py-2.5 rounded-xl border border-slate-700/50 hover:border-red-500/55 hover:bg-slate-900/60 shadow-2xl text-red-400 transition-all flex items-center gap-2 cursor-pointer duration-300"
          >
            <Sliders className="h-4.5 w-4.5" />
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider pr-1">Debris Sim Controls</span>
          </button>
        )}

        {/* EXPANDED COLLAPSIBLE FLOATING CONTROL PANEL (Top-Right overlay) */}
        {!isPanelCollapsed && (
          <div className="absolute top-4 right-4 z-10 w-96 max-h-[calc(100%-2rem)] overflow-y-auto glassmorphism p-5 rounded-2xl border border-slate-800/80 flex flex-col gap-4 shadow-2xl bg-slate-950/85 backdrop-blur-md scrollbar-thin">
            
            {/* Header with collapse button */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-900">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-red-500" />
                Debris Sim Controls
              </span>
              <button
                onClick={() => setIsPanelCollapsed(true)}
                className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer transition-colors"
                title="Minimize Panel"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Playback Controls */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono uppercase">
                <span>Simulator Timeline</span>
                <span>{(progress * 100).toFixed(0)}%</span>
              </div>

              {/* Segmented Progress bar */}
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex p-[1px] border border-slate-850">
                <div 
                  style={{ width: `${Math.min(50, progress * 100)}%` }} 
                  className={`h-full rounded-l transition-all duration-100 ${progress >= 0.5 ? 'bg-red-500/50' : 'bg-blue-500'}`}
                />
                <div 
                  style={{ width: `${hasImpacted ? Math.min(50, (progress - 0.5) * 100) : 0}%` }} 
                  className="h-full bg-red-600 rounded-r transition-all duration-100"
                />
              </div>

              <div className="flex gap-2 items-center justify-between mt-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`p-2.5 rounded-xl border font-bold text-slate-200 cursor-pointer transition-all duration-200
                      ${isPlaying 
                        ? 'bg-amber-600/10 border-amber-500/35 hover:bg-amber-500/20 text-amber-400' 
                        : 'bg-blue-600 hover:bg-blue-500 text-slate-100 border-transparent shadow-lg shadow-blue-500/15'
                      }`}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                    title="Reset Simulation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                {/* Speed selection */}
                <div className="flex gap-1 bg-slate-900/60 p-0.5 border border-slate-850 rounded-lg font-mono text-[9px]">
                  {([0.5, 1.0, 2.0, 5.0] as const).map(speed => (
                    <button
                      key={speed}
                      onClick={() => setSpeedMultiplier(speed)}
                      className={`px-2 py-1 rounded cursor-pointer transition-all font-semibold
                        ${speedMultiplier === speed ? 'bg-blue-600/20 text-blue-400 border border-blue-500/25' : 'text-slate-500 hover:text-slate-350'}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Telemetry Row */}
            <div className="flex flex-col gap-2.5 border-t border-slate-900 pt-3">
              <label className="text-[10px] font-bold text-slate-550 font-mono uppercase">Collision Telemetry</label>
              
              <div className="grid grid-cols-2 gap-2.5 font-mono text-[10px]">
                <div className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-xl">
                  <span className="text-[8px] text-slate-500 block mb-0.5">TOTAL FRAGMENTS</span>
                  <span className={`text-xs font-bold transition-all duration-300 ${hasImpacted ? 'text-red-400' : 'text-slate-405'}`}>
                    {fragmentCount.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-xl">
                  <span className="text-[8px] text-slate-500 block mb-0.5">CLOUD EXPANSION</span>
                  <span className={`text-xs font-bold transition-all duration-300 ${hasImpacted ? 'text-orange-450' : 'text-slate-405'}`}>
                    {cloudRadiusKm.toFixed(1)} km
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-xl">
                  <span className="text-[8px] text-slate-500 block mb-0.5">RELATIVE VELOCITY</span>
                  <span className="text-xs font-bold text-slate-300">11.65 km/s</span>
                </div>
                <div className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-xl">
                  <span className="text-[8px] text-slate-500 block mb-0.5">IMPACT ENERGY</span>
                  <span className={`text-xs font-bold transition-all duration-300 ${hasImpacted ? 'text-red-400' : 'text-slate-500'}`}>
                    {hasImpacted ? `${kineticEnergyGigaJoules.toFixed(1)} GJ` : "0.0 GJ"}
                  </span>
                </div>
              </div>
            </div>

            {/* Satellite Properties Configuration */}
            <div className="flex flex-col gap-2.5 border-t border-slate-900 pt-3">
              <div className="text-[10px] font-bold text-slate-550 font-mono uppercase flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-blue-400" />
                Impact Parameters
              </div>
              <div className="flex flex-col gap-2.5 font-mono text-[9px] text-slate-455">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>IRIDIUM 33 DRY MASS</span>
                    <span className="text-slate-300 font-bold">{sat1Mass} kg</span>
                  </div>
                  <input 
                    type="range" min="100" max="2000" step="50"
                    value={sat1Mass} onChange={(e) => setSat1Mass(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-blue-500"
                    disabled={isPlaying}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>COSMOS 2251 DRY MASS</span>
                    <span className="text-slate-300 font-bold">{sat2Mass} kg</span>
                  </div>
                  <input 
                    type="range" min="100" max="2000" step="50"
                    value={sat2Mass} onChange={(e) => setSat2Mass(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-900 rounded appearance-none cursor-pointer accent-blue-500"
                    disabled={isPlaying}
                  />
                </div>
              </div>
            </div>

            {/* Cinematic Camera Modes */}
            <div className="flex flex-col gap-2 border-t border-slate-900 pt-3">
              <div className="text-[10px] font-bold text-slate-550 font-mono uppercase flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-purple-400" />
                Cinematic Camera Mode
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px]">
                <button
                  onClick={() => setCameraMode('approach')}
                  className={`py-1.5 rounded-lg border text-center transition-colors cursor-pointer font-semibold
                    ${cameraMode === 'approach' ? 'bg-purple-600/15 border-purple-500/30 text-purple-400 shadow-md' : 'border-slate-850 text-slate-500 hover:text-slate-350 bg-slate-900/20'}`}
                >
                  TCA Approach
                </button>
                <button
                  onClick={() => setCameraMode('impact')}
                  className={`py-1.5 rounded-lg border text-center transition-colors cursor-pointer font-semibold
                    ${cameraMode === 'impact' ? 'bg-purple-600/15 border-purple-500/30 text-purple-400 shadow-md' : 'border-slate-850 text-slate-500 hover:text-slate-350 bg-slate-900/20'}`}
                  disabled={progress < 0.5}
                >
                  Zoom Impact
                </button>
                <button
                  onClick={() => setCameraMode('orbit')}
                  className={`py-1.5 rounded-lg border text-center transition-colors cursor-pointer font-semibold
                    ${cameraMode === 'orbit' ? 'bg-purple-600/15 border-purple-500/30 text-purple-400 shadow-md' : 'border-slate-850 text-slate-500 hover:text-slate-350 bg-slate-900/20'}`}
                  disabled={progress < 0.5}
                >
                  Debris Orbit
                </button>
                <button
                  onClick={() => setCameraMode('free')}
                  className={`py-1.5 rounded-lg border text-center transition-colors cursor-pointer font-semibold
                    ${cameraMode === 'free' ? 'bg-purple-600/15 border-purple-500/30 text-purple-400 shadow-md' : 'border-slate-850 text-slate-500 hover:text-slate-350 bg-slate-900/20'}`}
                >
                  Free Flight
                </button>
              </div>
            </div>

            {/* Kessler Cascade Risk Meter */}
            <div className="flex flex-col gap-2.5 border-t border-slate-900 pt-3">
              <div className="text-[10px] font-bold text-slate-550 font-mono uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                  Kessler Cascade Threat
                </span>
                <span className={hasImpacted ? "text-red-400 font-bold" : "text-slate-600"}>
                  {hasImpacted ? `${(dispersionProgress * 92 + 8).toFixed(0)}%` : "0%"}
                </span>
              </div>

              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-[1px] border border-slate-850 flex relative">
                <div 
                  style={{ width: `${hasImpacted ? (dispersionProgress * 92 + 8) : 0}%` }} 
                  className="h-full bg-gradient-to-r from-amber-550 to-red-600 rounded-full transition-all duration-350"
                />
                {hasImpacted && (
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] text-white font-mono font-bold tracking-wider animate-pulse">
                    CRITICAL CASCADING RISK ACTIVE
                  </span>
                )}
              </div>
            </div>

            {/* Debris Size Classification Table */}
            <div className="flex flex-col gap-2 border-t border-slate-900 pt-3 overflow-hidden">
              <div className="text-[10px] font-bold text-slate-550 font-mono uppercase flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                Fragment Size Estimates
              </div>
              <div className="border border-slate-850 rounded-xl overflow-hidden text-[9px] font-mono bg-slate-950/40">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 text-slate-500">
                      <th className="p-2 border-b border-slate-850">FRAGMENT SCALE</th>
                      <th className="p-2 border-b border-slate-850 text-right">COUNT</th>
                      <th className="p-2 border-b border-slate-850 text-right">THREAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-400">
                    <tr className="hover:bg-slate-900/30">
                      <td className="p-2 font-bold">LARGE (&gt; 10 cm)</td>
                      <td className="p-2 text-right text-slate-200">{sizeLarge}</td>
                      <td className="p-2 text-right text-red-400 font-bold">CRITICAL</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30">
                      <td className="p-2 font-bold">MEDIUM (1 - 10 cm)</td>
                      <td className="p-2 text-right text-slate-200">{sizeMedium}</td>
                      <td className="p-2 text-right text-amber-400 font-bold">WARNING</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30">
                      <td className="p-2 font-bold">SMALL (&lt; 1 cm)</td>
                      <td className="p-2 text-right text-slate-200">{sizeSmall}</td>
                      <td className="p-2 text-right text-emerald-450">MONITORED</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
