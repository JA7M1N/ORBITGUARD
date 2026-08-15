import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config';

export type ActivePanel = 
  | 'globe' 
  | 'conjunctions' 
  | 'reentry' 
  | 'swarm' 
  | 'compliance' 
  | 'solar' 
  | 'satellites' 
  | 'copilot' 
  | 'lunar' 
  | 'simulation'
  | 'docs';

interface SidebarProps {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
}

interface NavItem {
  id: ActivePanel;
  label: string;
  emoji: string;
  colorStart: string;
  colorEnd: string;
  glowColor: string;
}

interface CategoryGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activePanel, setActivePanel }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const categories: CategoryGroup[] = [
    {
      title: 'WORKSPACE',
      items: [
        { id: 'globe', label: 'Live Orbit Globe', emoji: '🌐', colorStart: '#2563eb', colorEnd: '#1d4ed8', glowColor: 'rgba(37, 99, 235, 0.4)' },
        { id: 'satellites', label: 'Satellite Catalog', emoji: '📡', colorStart: '#0891b2', colorEnd: '#0e7490', glowColor: 'rgba(8, 145, 178, 0.4)' },
        { id: 'conjunctions', label: 'Conjunction Screening', emoji: '⚠️', colorStart: '#d97706', colorEnd: '#b45309', glowColor: 'rgba(217, 119, 6, 0.4)' },
        { id: 'solar', label: 'Space Weather', emoji: '☀️', colorStart: '#ca8a04', colorEnd: '#a16207', glowColor: 'rgba(202, 138, 4, 0.4)' }
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        { id: 'compliance', label: 'Compliance Hub', emoji: '📋', colorStart: '#475569', colorEnd: '#334155', glowColor: 'rgba(71, 85, 105, 0.4)' },
        { id: 'lunar', label: 'Lunar Safety Hub', emoji: '🌕', colorStart: '#fef08a', colorEnd: '#eab308', glowColor: 'rgba(234, 179, 8, 0.3)' }
      ]
    },
    {
      title: 'ANALYSIS',
      items: [
        { id: 'copilot', label: 'Secure AI Copilot', emoji: '💬', colorStart: '#7c3aed', colorEnd: '#5b21b6', glowColor: 'rgba(124, 58, 237, 0.4)' },
        { id: 'swarm', label: 'Swarm Agent Orchestrator', emoji: '🤖', colorStart: '#db2777', colorEnd: '#9d174d', glowColor: 'rgba(219, 39, 119, 0.4)' },
        { id: 'simulation', label: 'Debris Collision Sim', emoji: '💥', colorStart: '#ef4444', colorEnd: '#b91c1c', glowColor: 'rgba(239, 68, 68, 0.4)' },
        { id: 'reentry', label: 'Reentry Alerts', emoji: '🛬', colorStart: '#0d9488', colorEnd: '#0f766e', glowColor: 'rgba(13, 148, 136, 0.4)' },
        { id: 'docs', label: 'API Documentation', emoji: '📄', colorStart: '#6366f1', colorEnd: '#4f46e5', glowColor: 'rgba(99, 102, 241, 0.4)' }
      ]
    }
  ];

  return (
    <aside 
      className={`w-full shrink-0 flex flex-col gap-5 p-4 border-r border-slate-900 bg-slate-950/80 shadow-[4px_0_24px_rgba(0,0,0,0.15)] md:min-h-[calc(100vh-80px)] transition-all duration-300 ease-in-out select-none
        ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
    >
      {/* Navigation section */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
        
        {/* Header Title & Collapse Button */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'} mb-1 shrink-0`}>
          {!isCollapsed && (
            <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase select-none font-mono">
              NAVIGATION
            </span>
          )}
          <button
            onClick={toggleCollapse}
            className="p-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors duration-200 shrink-0 cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        
        {/* Nav list categories */}
        <div className="flex flex-col gap-5">
          {categories.map((category) => (
            <div key={category.title} className="flex flex-col gap-1.5">
              {!isCollapsed && (
                <span className="text-[9px] font-bold tracking-wider text-slate-600 uppercase select-none font-mono px-2 mb-1">
                  {category.title}
                </span>
              )}
              
              <nav className="flex flex-col gap-1">
                {category.items.map((item) => {
                  const isActive = activePanel === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'docs') {
                          window.open(`${API_BASE_URL}/docs`, '_blank');
                        } else {
                          setActivePanel(item.id);
                        }
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 relative group cursor-pointer
                        ${isCollapsed ? 'justify-center px-0' : ''}
                        ${isActive 
                          ? 'bg-slate-900/80 border border-slate-850/80 text-slate-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
                        }`}
                    >
                      {/* Premium Glowing Emoji Container */}
                      <div 
                        className={`h-7 w-7 rounded-lg flex items-center justify-center text-sm font-normal transition-all duration-300 shrink-0
                          ${isActive 
                            ? 'scale-110 shadow-lg text-white font-bold' 
                            : 'bg-slate-900/80 border border-slate-800/80 group-hover:scale-105 group-hover:border-slate-700/60'
                          }`}
                        style={{
                          boxShadow: isActive ? `0 0 12px ${item.glowColor}, inset 0 1px 1px rgba(255,255,255,0.1)` : undefined,
                          backgroundImage: isActive ? `linear-gradient(135deg, ${item.colorStart}, ${item.colorEnd})` : undefined,
                          borderColor: isActive ? item.colorStart : undefined,
                        }}
                      >
                        <span className="filter drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.35)] select-none">
                          {item.emoji}
                        </span>
                      </div>
                      
                      {!isCollapsed && (
                        <span className="truncate transition-all duration-350 tracking-wide font-sans text-left">
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* Footer status panel */}
      <div className={`pt-4 border-t border-slate-900 flex ${isCollapsed ? 'justify-center' : 'items-center justify-between'} font-mono text-[9px] font-bold tracking-widest`}>
        {!isCollapsed ? (
          <>
            <span className="text-slate-500 uppercase select-none">ORBITWATCH SSA</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-green"></span>
              ONLINE
            </span>
          </>
        ) : (
          <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-green cursor-help" title="ORBITWATCH SSA: ONLINE"></span>
        )}
      </div>
    </aside>
  );
};
