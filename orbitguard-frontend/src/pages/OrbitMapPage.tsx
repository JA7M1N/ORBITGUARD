import React, { useState } from 'react';
import axios from 'axios';
import { OrbitGlobe } from '../components/OrbitGlobe';
import { API_BASE_URL } from '../config';
import { Upload, X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface OrbitMapPageProps {
  isSimActive?: boolean;
  selectedSatIdOverride?: string;
  isTrackingOverride?: boolean;
}

export const OrbitMapPage: React.FC<OrbitMapPageProps> = ({ 
  isSimActive = false,
  selectedSatIdOverride,
  isTrackingOverride = false
}) => {
  const [showDebris, setShowDebris] = useState<boolean>(true);
  const [showPayloads, setShowPayloads] = useState<boolean>(true);
  const [showSensors, setShowSensors] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(30);
  const [multiplier, setMultiplier] = useState<number>(60);

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [tleInput, setTleInput] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleImportTle = async () => {
    const trimmed = tleInput.trim();
    if (!trimmed) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l !== '');
      let name: string | undefined = undefined;
      let tle1 = '';
      let tle2 = '';
      
      if (lines.length >= 3) {
        name = lines[0];
        tle1 = lines[1];
        tle2 = lines[2];
      } else if (lines.length === 2) {
        tle1 = lines[0];
        tle2 = lines[1];
      } else {
        throw new Error("TLE must contain 2 or 3 lines.");
      }
      
      const response = await axios.post(`${API_BASE_URL}/api/satellites/import`, {
        name,
        tle1,
        tle2
      });
      
      setImportResult({
        success: true,
        message: `Successfully imported ${response.data.name} (NORAD ${response.data.norad_id}). Screened ${response.data.conjunctions_detected} close approach hazards!`
      });
      setTleInput('');
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.response?.data?.detail || err.message || "Failed to import TLE."
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] overflow-hidden rounded-2xl">
      {/* Floating TLE Import Trigger */}
      <div className="absolute top-4 left-4 z-10">
        {!isPanelOpen ? (
          <button
            onClick={() => {
              setIsPanelOpen(true);
              setImportResult(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-500/30 bg-slate-900/90 text-slate-100 hover:bg-slate-800 text-xs font-semibold tracking-wide shadow-2xl transition-all cursor-pointer"
          >
            <Upload className="h-4 w-4 text-blue-400" />
            Import Custom TLE
          </button>
        ) : (
          <div className="w-80 bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl glassmorphism animate-slide-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-900">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                TLE Self-Serve Import
              </span>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="text-slate-500 hover:text-slate-350 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-[10px] text-slate-450 leading-relaxed font-sans">
              Paste a standard 2-line or 3-line TLE set below to propagate its orbit and screen conjunctions in real-time.
            </p>
            
            <textarea
              rows={4}
              value={tleInput}
              onChange={(e) => setTleInput(e.target.value)}
              placeholder="e.g.&#10;MY_CUBESAT&#10;1 99999U 26001A   26180.12345678 ...&#10;2 99999  98.2000 120.3000 ..."
              className="w-full bg-slate-900 border border-slate-850 p-2 text-[10px] rounded-lg text-slate-200 placeholder-slate-500 font-mono resize-none font-sans"
            />
            
            <button
              onClick={handleImportTle}
              disabled={isImporting || !tleInput.trim()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-slate-100 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Propagating...
                </>
              ) : (
                "Deploy and Screen"
              )}
            </button>
            
            {importResult && (
              <div className={`p-3 rounded-lg border flex gap-2 items-start font-mono text-[9px]
                ${importResult.success 
                  ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400' 
                  : 'border-red-500/20 bg-red-950/20 text-red-400'
                }`}
              >
                {importResult.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span className="leading-relaxed font-sans">{importResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main 3D Canvas container */}
      <div className="w-full h-full relative">
        <OrbitGlobe
          limit={limit}
          setLimit={setLimit}
          showDebris={showDebris}
          setShowDebris={setShowDebris}
          showPayloads={showPayloads}
          setShowPayloads={setShowPayloads}
          showSensors={showSensors}
          setShowSensors={setShowSensors}
          showHeatmap={showHeatmap}
          setShowHeatmap={setShowHeatmap}
          isSimActive={isSimActive}
          multiplier={multiplier}
          setMultiplier={setMultiplier}
          selectedSatIdOverride={selectedSatIdOverride}
          isTrackingOverride={isTrackingOverride}
        />
      </div>
    </div>
  );
};
