import React from 'react';
import { Globe, RefreshCw, AlertOctagon, Terminal, FileText, Sun, Database, MessageSquare, Moon } from 'lucide-react';

export type ActivePanel = 'globe' | 'conjunctions' | 'reentry' | 'swarm' | 'compliance' | 'solar' | 'satellites' | 'copilot' | 'lunar';

interface SidebarProps {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
}

interface NavItem {
  id: ActivePanel;
  label: string;
  icon: React.ComponentType<any>;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePanel, setActivePanel }) => {
  const navItems: NavItem[] = [
    { id: 'globe', label: 'Live Orbit Globe', icon: Globe },
    { id: 'satellites', label: 'Satellite Catalog', icon: Database },
    { id: 'conjunctions', label: 'Conjunction Screening', icon: RefreshCw },
    { id: 'reentry', label: 'Reentry Alerts', icon: AlertOctagon },
    { id: 'swarm', label: 'Swarm Agent Orchestrator', icon: Terminal },
    { id: 'compliance', label: 'Compliance Hub', icon: FileText },
    { id: 'solar', label: 'Space Weather', icon: Sun },
    { id: 'copilot', label: 'Secure AI Copilot', icon: MessageSquare },
    { id: 'lunar', label: 'Lunar Safety Hub', icon: Moon },
  ];

  return (
    <aside className="w-full md:w-64 shrink-0 flex flex-col gap-6 p-4 border-r border-slate-800 bg-slate-950/20 glassmorphism md:min-h-[calc(100vh-80px)]">
      {/* Navigation section */}
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase px-3 mb-2">MISSION MONITORING</p>
        
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 relative group
                  ${isActive 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.08)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                  }`}
              >
                {/* Visual Active Bar indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r bg-blue-500"></span>
                )}
                
                <Icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:scale-110 
                  ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} 
                />
                
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status footer panel inside sidebar */}
      <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">SGP4 PROPAGATOR</span>
          <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-green"></span>
            NOMINAL
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">KD-TREE SCREENER</span>
          <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-green"></span>
            ACTIVE
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">WEATHER FEED (NOAA)</span>
          <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-green"></span>
            SYNCED
          </span>
        </div>
      </div>
    </aside>
  );
};
