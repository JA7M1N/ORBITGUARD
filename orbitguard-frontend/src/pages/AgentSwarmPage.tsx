import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Play, RefreshCw, Cpu, Activity, Download } from 'lucide-react';
import { getWebSocketUrl, API_BASE_URL } from '../config';


interface SwarmLogFrame {
  percentage: number;
  agent: string;
  log: string;
  timestamp: string;
  filing_id?: number;
}

export const AgentSwarmPage: React.FC = () => {
  const [logs, setLogs] = useState<SwarmLogFrame[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [activeStep, setActiveStep] = useState<number>(-1); // -1 = idle, 0 = Ingest, 1 = Analyze, 2 = Execute, 3 = Document
  const [filingId, setFilingId] = useState<number | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll terminal logs to bottom on changes
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const getStepIndex = (agentName: string): number => {
    const name = agentName.toUpperCase();
    if (name.includes("INGESTION")) return 0;
    if (name.includes("SCREENING") || name.includes("MATH")) return 1;
    if (name.includes("DECAY") || name.includes("PLANNER")) return 2;
    if (name.includes("COMPLIANCE")) return 3;
    return -1;
  };

  const startPipeline = () => {
    if (isRunning) return;
    
    setLogs([]);
    setProgress(0);
    setActiveStep(0);
    setFilingId(null);
    setIsRunning(true);
    
    // Create new WebSocket client connecting to FastAPI backend websocket
    const ws = new WebSocket(getWebSocketUrl("/api/ws/swarm/run"));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const frame: SwarmLogFrame = JSON.parse(event.data);
        setLogs(prev => [...prev, frame]);
        setProgress(frame.percentage);
        
        if (frame.filing_id) {
          setFilingId(frame.filing_id);
        }
        
        const stepIdx = getStepIndex(frame.agent);
        if (stepIdx !== -1) {
          setActiveStep(stepIdx);
        }
      } catch (e) {
        console.error("Error parsing WebSocket log frame:", e);
      }
    };

    ws.onclose = () => {
      setIsRunning(false);
      setProgress(100);
      setActiveStep(3); // final document step completed
      setLogs(prev => [...prev, {
        percentage: 100,
        agent: "SWARM_ORCHESTRATOR",
        log: "Swarm Pipeline complete. Connection closed successfully.",
        timestamp: new Date().toISOString()
      }]);
    };

    ws.onerror = (err) => {
      console.error("WebSocket swarm connection error:", err);
      setIsRunning(false);
      setLogs(prev => [...prev, {
        percentage: 100,
        agent: "SYSTEM_ERROR",
        log: "Swarm socket connection lost or failed to reach host gateway.",
        timestamp: new Date().toISOString()
      }]);
    };
  };

  const stopPipeline = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsRunning(false);
  };

  // Node helper coordinates
  const steps = [
    { 
      label: "Ingest", 
      desc: "TLE Catalog Ingestion", 
      agent: "INGESTION_AGENT",
      libraries: "Celestrak API, requests" 
    },
    { 
      label: "Analyze", 
      desc: "Proximity KD-Tree & Pc", 
      agent: "SCREENING / MATH",
      libraries: "scipy.spatial, scipy.special" 
    },
    { 
      label: "Execute", 
      desc: "Reentry Decay & Burns", 
      agent: "REENTRY_AGENT / MANEUVER",
      libraries: "RK4 Integrator, numpy" 
    },
    { 
      label: "Document", 
      desc: "Compliance & PDF brief", 
      agent: "COMPLIANCE_AGENT",
      libraries: "Llama 3.2, reportlab" 
    }
  ];

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
      {/* 1. TOP HEADER AND PROGRESS BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glassmorphism p-5 rounded-2xl border border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600/10 border border-purple-500/30 rounded-xl text-purple-400">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">Swarm Agent Orchestrator</h2>
            <p className="text-slate-400 text-xs mt-0.5">Stream live agent logs, consensus screening pipelines, and maneuvers modeling.</p>
          </div>
        </div>

        {/* Swarm Live Telemetry stats */}
        <div className="hidden xl:flex items-center gap-6 font-mono text-[9px] text-slate-500">
          <div className="flex flex-col gap-0.5 border-l border-slate-850 pl-4">
            <span className="text-slate-500 uppercase">SOCKET STATUS</span>
            <span className="flex items-center gap-1.5 text-slate-300 font-bold uppercase">
              <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600 animate-ping shrink-0'}`} />
              {isRunning ? "Connected" : "Idle"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-slate-850 pl-4">
            <span className="text-slate-500 uppercase">LOGS INGESTED</span>
            <span className="text-purple-400 font-bold font-mono">{logs.length} Lines</span>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-slate-850 pl-4">
            <span className="text-slate-500 uppercase">AGENT LATENCY</span>
            <span className="text-slate-300 font-bold font-mono">{isRunning ? "< 12ms" : "N/A"}</span>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-slate-850 pl-4">
            <span className="text-slate-500 uppercase">FILING STATUS</span>
            <span className="text-slate-350 font-bold uppercase">{filingId ? "Consensus Signed" : "No active file"}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {filingId && (
            <button
              onClick={() => window.open(`${API_BASE_URL}/api/compliance/download/${filingId}`, '_blank')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-colors shadow-lg shadow-emerald-600/15"
            >
              <Download className="h-4 w-4" />
              Download Swarm PDF Report
            </button>
          )}
          {isRunning ? (
            <button
              onClick={stopPipeline}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-950/40 text-red-400 border border-red-500/30 hover:bg-red-900/40 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-colors"
            >
              <RefreshCw className="h-4 w-4 animate-spin" />
              Terminate Swarm
            </button>
          ) : (
            <button
              onClick={startPipeline}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-slate-100 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-colors shadow-lg shadow-purple-600/15"
            >
              <Play className="h-4 w-4" />
              Initiate Pipeline
            </button>
          )}
        </div>
      </div>

      {/* 2. DYNAMIC PROGRESS NODES MAP */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 shrink-0">
        {steps.map((s, idx) => {
          const isCompleted = activeStep > idx;
          const isActive = activeStep === idx;
          return (
            <React.Fragment key={s.label}>
              {idx > 0 && (
                <div className="hidden lg:flex items-center justify-center shrink-0">
                  <div className={`h-[2px] w-6 transition-all duration-500 
                    ${isCompleted ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-slate-800'}`} 
                  />
                </div>
              )}
              
              <div 
                className={`flex-1 p-4 rounded-xl border transition-all duration-500 flex flex-col gap-1.5 relative overflow-hidden min-w-[200px]
                  ${isActive 
                    ? 'bg-purple-600/10 border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.25)] scale-[1.03] z-10' 
                    : isCompleted
                      ? 'bg-emerald-950/10 border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                      : 'bg-slate-950/20 border-slate-850/50 opacity-50'
                  }`}
              >
                {/* Active node glow indicator */}
                {isActive && (
                  <div className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-purple-400 m-3 shadow-[0_0_8px_#a855f7] animate-ping"></div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest">
                    STEP 0{idx + 1}
                  </span>
                  <span className={`h-2 w-2 rounded-full transition-all duration-500 ${
                    isActive 
                      ? 'bg-purple-400 shadow-[0_0_8px_#a855f7] animate-pulse' 
                      : isCompleted
                        ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                        : 'bg-slate-800'
                  }`}></span>
                </div>
                
                <div>
                  <h4 className={`text-sm font-bold tracking-wide transition-colors ${isActive ? 'text-purple-400' : 'text-slate-200'}`}>
                    {s.label}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-tight">{s.desc}</p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-900/60 flex flex-col gap-1 text-[9px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-600">AGENT:</span>
                    <span className={isActive ? "text-purple-400 font-bold" : isCompleted ? "text-slate-450" : "text-slate-600"}>{s.agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">LIBS:</span>
                    <span className={isActive ? "text-purple-400" : isCompleted ? "text-slate-500" : "text-slate-700"}>{s.libraries}</span>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 3. RETRO GLOWING TERMINAL */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden relative shadow-2xl">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-900 bg-slate-950 text-slate-500 font-mono text-[10px] shrink-0">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-3.5 w-3.5 text-slate-400" />
            <span>SWARM_MONITOR_VT100.SH</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold">
              <Activity className="h-3 w-3" />
              Progress: {progress}%
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          </div>
        </div>

        {/* CRT Scanline Filter effect overlays */}
        <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px]"></div>

        {/* Terminal Output scroll window */}
        <div className="flex-1 overflow-y-auto p-5 font-mono text-xs text-emerald-400/90 flex flex-col gap-1.5 scrollbar-thin">
          {logs.length === 0 ? (
            <div className="flex flex-col gap-1 text-slate-600 mt-2">
              <div>// OrbitGuard Swarm Orchestrator active monitor interface.</div>
              <div>// Click "Initiate Pipeline" above to connect websocket node.</div>
              <div className="flex items-center gap-1 mt-3">
                <span className="h-2 w-1.5 bg-emerald-500 animate-pulse"></span>
                <span>Awaiting connection...</span>
              </div>
            </div>
          ) : (
            <>
              {logs.map((log, i) => (
                <div key={i} className="flex gap-4 hover:bg-emerald-500/5 py-0.5 px-1 rounded transition-colors group">
                  <span className="text-[10px] text-emerald-600 select-none shrink-0 min-w-[70px]">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className={`font-bold shrink-0 min-w-[130px] ${
                    log.agent.includes("ERROR") 
                      ? 'text-red-400' 
                      : log.agent.includes("COMPLIANCE") 
                        ? 'text-blue-400' 
                        : 'text-purple-400'
                  }`}>
                    {log.agent}
                  </span>
                  <span className="text-slate-300 break-all leading-normal group-hover:text-emerald-300">
                    {log.log}
                  </span>
                </div>
              ))}
              
              {/* Blinking cursor at the end of streaming execution logs */}
              {isRunning && (
                <div className="flex gap-4 py-0.5 px-1 mt-1">
                  <span className="text-[10px] text-emerald-600 select-none shrink-0 min-w-[70px]"></span>
                  <span className="text-emerald-500 font-bold shrink-0 min-w-[130px]">ACTIVE_AGENT</span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-2 bg-emerald-500 animate-pulse"></span>
                    <span className="text-slate-500 italic text-[10px]">analyzing next telemetry batch...</span>
                  </span>
                </div>
              )}
            </>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
