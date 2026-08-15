import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { 
  FileText, 
  User, 
  AlertTriangle, 
  Download, 
  CheckCircle, 
  FileCheck,
  RefreshCw
} from 'lucide-react';
import type { ConjunctionEvent, ConjunctionDetails } from '../types';

interface CompliancePageProps {
  selectedConjunction: { id: string; satellite: string } | null;
  activeSubTab?: 'filings' | 'deorbit';
  setActiveSubTab?: (tab: 'filings' | 'deorbit') => void;
}

export const CompliancePage: React.FC<CompliancePageProps> = ({ 
  selectedConjunction,
  activeSubTab: controlledSubTab,
  setActiveSubTab: setControlledSubTab
}) => {
  const [conjunctions, setConjunctions] = useState<ConjunctionEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [operatorName, setOperatorName] = useState<string>("ISRO Space Situational Awareness (SSA) Group");
  
  // Selected conjunction metadata
  const [eventDetails, setEventDetails] = useState<ConjunctionDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Filing outputs
  const [filingResult, setFilingResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pastFilings, setPastFilings] = useState<any[]>([]);

  // Sub-tab selection
  const [internalSubTab, setInternalSubTab] = useState<'filings' | 'deorbit'>('filings');
  const activeSubTab = controlledSubTab !== undefined ? controlledSubTab : internalSubTab;
  const setActiveSubTab = (tab: 'filings' | 'deorbit') => {
    if (setControlledSubTab) {
      setControlledSubTab(tab);
    } else {
      setInternalSubTab(tab);
    }
  };
  
  // Deorbit Audit states
  const [satellitesList, setSatellitesList] = useState<any[]>([]);
  const [selectedAuditSatId, setSelectedAuditSatId] = useState<string>("custom");
  const [customAlt, setCustomAlt] = useState<number>(450);
  const [ballisticCoeff, setBallisticCoeff] = useState<number>(0.012);
  const [deorbitSolarScenario, setDeorbitSolarScenario] = useState<string>("nominal");
  const [auditResult, setAuditResult] = useState<any>(null);
  const [isRunningAudit, setIsRunningAudit] = useState<boolean>(false);

  // Fetch satellites list for audit
  useEffect(() => {
    const fetchSats = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/satellites?limit=100`);
        if (response.data && response.data.results) {
          setSatellitesList(response.data.results);
        }
      } catch (err) {
        console.error("Error loading satellites list for deorbit audit:", err);
      }
    };
    fetchSats();
  }, []);

  // Run 5-Year Deorbit Audit
  const handleRunDeorbitAudit = async () => {
    setIsRunningAudit(true);
    setAuditResult(null);
    try {
      const payload: any = {
        ballistic_coefficient: ballisticCoeff,
        solar_scenario: deorbitSolarScenario
      };
      if (selectedAuditSatId === "custom") {
        payload.altitude_km = customAlt;
      } else {
        payload.norad_id = parseInt(selectedAuditSatId);
      }
      
      const response = await axios.post(`${API_BASE_URL}/api/deorbit/audit`, payload);
      setAuditResult(response.data);
    } catch (err: any) {
      console.error("Error running deorbit audit:", err);
    } finally {
      setIsRunningAudit(false);
    }
  };

  // Canvas drawing hook for deorbit decay curve
  useEffect(() => {
    if (!auditResult || !auditResult.trajectory) return;
    const canvas = document.getElementById('deorbitChartCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const traj = auditResult.trajectory;
    const margin = { top: 15, right: 15, bottom: 25, left: 35 };
    const width = canvas.width - margin.left - margin.right;
    const height = canvas.height - margin.top - margin.bottom;

    // Find min/max values
    const maxYear = 5.0; // FCC limit
    const minAlt = 80;
    const maxAlt = Math.max(...traj.map((t: any) => t.altitude_km));

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    ctx.font = '8px monospace';
    ctx.fillStyle = '#64748b';

    // Horizontal grid lines (Altitude)
    const yGridSteps = 4;
    for (let i = 0; i <= yGridSteps; i++) {
      const val = minAlt + (maxAlt - minAlt) * (i / yGridSteps);
      const y = margin.top + height - (i / yGridSteps) * height;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + width, y);
      ctx.stroke();
      ctx.fillText(`${val.toFixed(0)}km`, 2, y + 3);
    }

    // Vertical grid lines (Years)
    const xGridSteps = 5;
    for (let i = 0; i <= xGridSteps; i++) {
      const val = (maxYear * (i / xGridSteps));
      const x = margin.left + (i / xGridSteps) * width;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + height);
      ctx.stroke();
      ctx.fillText(`${val.toFixed(0)}y`, x - 5, margin.top + height + 12);
    }

    // Plot data points
    ctx.beginPath();
    traj.forEach((pt: any, idx: number) => {
      const xRatio = pt.year / maxYear;
      const yRatio = (pt.altitude_km - minAlt) / (maxAlt - minAlt);
      
      const x = margin.left + Math.min(xRatio, 1.0) * width;
      const y = margin.top + height - yRatio * height;

      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // Style and draw line
    ctx.strokeStyle = auditResult.compliance_status === 'PASSED' ? '#10b981' : '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 5-Year threshold limit line (dashed)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    const limitX = margin.left + width;
    ctx.moveTo(limitX, margin.top);
    ctx.lineTo(limitX, margin.top + height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.fillText('5-Year Limit', limitX - 55, margin.top + 8);
  }, [auditResult]);

  const fetchPastFilings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/compliance`);
      setPastFilings(response.data);
    } catch (e) {
      console.error("Error fetching past filings list:", e);
    }
  };

  useEffect(() => {
    fetchPastFilings();
  }, [filingResult]);

  // 1. Fetch active conjunctions dropdown list
  useEffect(() => {
    const fetchList = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/conjunctions`);
        setConjunctions(response.data);
        
        // Handle pre-selected conjunction redirection
        if (selectedConjunction) {
          setSelectedEventId(selectedConjunction.id);
        } else if (response.data.length > 0) {
          setSelectedEventId(String(response.data[0].id));
        }
      } catch (e) {
        console.error("Error fetching conjunctions list:", e);
      }
    };
    fetchList();
  }, [selectedConjunction]);

  // 2. Fetch specific details when the dropdown selection changes
  useEffect(() => {
    if (!selectedEventId) {
      setEventDetails(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        setErrorMsg(null);
        const response = await axios.get(`${API_BASE_URL}/api/conjunctions/${selectedEventId}`);
        setEventDetails(response.data);
      } catch (e) {
        console.error("Error fetching conjunction details for filing:", e);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedEventId]);

  // 3. Form Submission
  const handleSubmitFiling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !operatorName.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      setFilingResult(null);

      const response = await axios.post(`${API_BASE_URL}/api/compliance/file`, {
        event_id: selectedEventId,
        operator_name: operatorName
      });
      
      setFilingResult(response.data);
    } catch (e: any) {
      console.error("Error submitting compliance filing:", e);
      setErrorMsg(e.response?.data?.detail || "An unexpected error occurred during report compilation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger PDF file download directly
  const handleDownloadPdf = () => {
    if (!filingResult) return;
    window.open(`${API_BASE_URL}/api/compliance/download/${filingResult.id}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-5 w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
      {/* Sub-tab selection bar */}
      <div className="flex gap-2 p-1 bg-slate-900/40 border border-slate-805 rounded-xl max-w-md shrink-0">
        <button
          onClick={() => { setActiveSubTab('filings'); setAuditResult(null); }}
          className={`flex-1 py-2 text-center font-mono text-[9px] font-bold rounded-lg cursor-pointer transition-colors
            ${activeSubTab === 'filings' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          REGULATORY FILINGS (INSPACE-CAM)
        </button>
        <button
          onClick={() => { setActiveSubTab('deorbit'); setAuditResult(null); }}
          className={`flex-1 py-2 text-center font-mono text-[9px] font-bold rounded-lg cursor-pointer transition-colors
            ${activeSubTab === 'deorbit' ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-305'}`}
        >
          5-YEAR DEORBIT COMPLIANCE AUDIT
        </button>
      </div>

      {activeSubTab === 'filings' ? (
        <div className="flex flex-col xl:flex-row gap-6 w-full flex-1 min-h-0 select-none">
          {/* LEFT PANE: Filing Form Inputs */}
          <div className="w-full xl:w-[480px] shrink-0 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileText className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-sm tracking-wider text-slate-100 uppercase">INSPACE-CAM-2026 Form</h3>
            </div>

            <form onSubmit={handleSubmitFiling} className="flex flex-col gap-4">
              {/* Operator Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Operator Organization
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    required
                    placeholder="Enter operator group..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-350 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Conjunction Event Dropdown Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Conjunction Event Target
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-350 focus:border-blue-500 focus:outline-none transition-colors"
                >
                  {conjunctions.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-950">
                      ID {c.id} - {c.primary_name} vs {c.secondary_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pre-populated Read-Only Conjunction Telemetry fields */}
              {loadingDetails ? (
                <div className="py-8 text-center text-xs font-mono text-slate-500">
                  Fetching event metadata...
                </div>
              ) : eventDetails ? (
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl flex flex-col gap-2.5 font-mono text-[11px] text-slate-400">
                  <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Filing Parameters (Auto-Resolved)
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>PRIMARY SAT</span>
                    <span className="text-slate-200 font-semibold">{eventDetails.primary.name} ({eventDetails.primary.norad_id})</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>CHALLENGER SAT</span>
                    <span className="text-slate-200 font-semibold">{eventDetails.secondary.name} ({eventDetails.secondary.norad_id})</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>TCA EPOCH</span>
                    <span className="text-slate-200">{new Date(eventDetails.tca).toLocaleString()} UTC</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>MISS DISTANCE</span>
                    <span className="text-slate-200">{eventDetails.miss_distance.toFixed(3)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span>COLLISION PC</span>
                    <span className="text-red-400 font-bold">{eventDetails.pc.toExponential(4)}</span>
                  </div>
                </div>
              ) : null}

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl flex items-start gap-2 text-[11px] text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Action */}
              <button
                type="submit"
                disabled={isSubmitting || !selectedEventId}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 text-slate-100 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Compiling Report...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4" />
                    Submit Regulatory Filing
                  </>
                )}
              </button>
            </form>

            {/* Submitted Filings Registry */}
            <div className="flex flex-col gap-2.5 mt-4 border-t border-slate-800/80 pt-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Submitted Filings ({pastFilings.length})
              </div>
              {pastFilings.length === 0 ? (
                <div className="text-[10px] font-mono text-slate-650 italic">
                  No past filings found.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {pastFilings.map((filing) => (
                    <div key={filing.id} className="flex items-center justify-between bg-slate-950/30 border border-slate-900/60 p-2.5 rounded-xl text-[10px] font-mono">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-300 font-semibold truncate max-w-[150px]">
                          {filing.satellite} (Filing #{filing.id})
                        </span>
                        <span className="text-[9px] text-slate-550">
                          {new Date(filing.submitted_at).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          window.open(`${API_BASE_URL}/api/compliance/download/${filing.id}`, '_blank');
                        }}
                        className="flex items-center justify-center gap-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-emerald-400 p-1.5 rounded transition-colors cursor-pointer"
                        title="Download Report PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Compiled Filing Brief Output */}
          <div className="flex-1 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
            {!filingResult ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-3 border border-dashed border-slate-850 rounded-xl">
                <FileText className="h-12 w-12 text-slate-700/60" />
                <h4 className="text-sm font-semibold text-slate-400">Awaiting Submission</h4>
                <p className="text-xs max-w-sm">Complete the INSPACE form on the left. The generated Llama-3.2 compliance statement and PDF compiler controls will load here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 h-full">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <h3 className="font-bold text-sm tracking-wider text-slate-100 uppercase">Filing Compiled successfully</h3>
                  </div>
                  
                  <button
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-lg text-xs font-bold font-mono transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </button>
                </div>

                {/* Generated Compliance brief text */}
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    AI Compliance Briefing Statement (Llama 3.2 generated)
                  </div>
                  <div className="flex-1 p-4 bg-slate-950/40 border border-slate-900 rounded-xl font-mono text-[11px] text-slate-350 overflow-y-auto leading-relaxed whitespace-pre-line border-t-2 border-t-blue-500">
                    {filingResult.form_data.briefing}
                  </div>
                </div>

                {/* PDF Details info footer */}
                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[10px] text-slate-405 shrink-0">
                  <div>
                    <span className="text-slate-650 block">FILING ID</span>
                    <span className="text-slate-300 font-bold"># {filingResult.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-655 block">STATUS</span>
                    <span className="text-emerald-400 font-bold uppercase">{filingResult.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-655 block">SUBMITTED AT</span>
                    <span className="text-slate-300">{new Date(filingResult.submitted_at).toLocaleTimeString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-655 block">SERVER TARGET</span>
                    <span className="text-blue-400 truncate block" title={filingResult.pdf_path}>INSPACE-CAM-2026.pdf</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 w-full flex-1 min-h-0 select-none">
          {/* LEFT PANEL: Audit Configuration */}
          <div className="w-full lg:w-96 shrink-0 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileText className="h-5 w-5 text-purple-400" />
              <h3 className="font-bold text-sm tracking-wider text-slate-100 uppercase">Deorbit Audit Config</h3>
            </div>

            <div className="flex flex-col gap-4">
              {/* Satellite Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Select Satellite for Audit</label>
                <select
                  value={selectedAuditSatId}
                  onChange={(e) => setSelectedAuditSatId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-350 focus:border-purple-500 focus:outline-none transition-colors"
                >
                  <option value="custom" className="bg-slate-950">Custom Spacecraft Parameters</option>
                  {satellitesList.map((sat) => (
                    <option key={sat.norad_id} value={sat.norad_id} className="bg-slate-950">
                      {sat.name} (NORAD {sat.norad_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Altitude Slider */}
              {selectedAuditSatId === 'custom' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    <span>Initial Altitude (km)</span>
                    <span className="text-purple-400 font-mono">{customAlt} km</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="1000"
                    step="10"
                    value={customAlt}
                    onChange={(e) => setCustomAlt(parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Ballistic Coefficient Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  <span>Ballistic Coefficient (m²/kg)</span>
                  <span className="text-purple-400 font-mono">{ballisticCoeff.toFixed(4)}</span>
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="0.100"
                  step="0.001"
                  value={ballisticCoeff}
                  onChange={(e) => setBallisticCoeff(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                />
              </div>

              {/* Solar Weather Scenario Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Solar Cycle Scenario</label>
                <div className="grid grid-cols-3 gap-2">
                  {['quiet', 'nominal', 'stormy'].map((scen) => (
                    <button
                      key={scen}
                      type="button"
                      onClick={() => setDeorbitSolarScenario(scen)}
                      className={`py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider font-mono border cursor-pointer transition-all
                        ${deorbitSolarScenario === scen 
                          ? 'bg-purple-600/10 text-purple-400 border-purple-500/30' 
                          : 'bg-slate-950/40 text-slate-500 border-slate-900 hover:border-slate-800 hover:text-slate-400'
                        }`}
                    >
                      {scen}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunDeorbitAudit}
                disabled={isRunningAudit}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 text-slate-100 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all cursor-pointer"
              >
                {isRunningAudit ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Propagating Decay...
                  </>
                ) : (
                  "Run 5-Year Deorbit Audit"
                )}
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Audit Briefing & Decay Plot */}
          <div className="flex-1 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto font-sans">
            {!auditResult ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-3 border border-dashed border-slate-850 rounded-xl">
                <FileText className="h-12 w-12 text-slate-700/60" />
                <h4 className="text-sm font-semibold text-slate-400">Awaiting Audit Propagation</h4>
                <p className="text-xs max-w-sm font-sans">Set the orbital altitude and drag configuration parameters on the left. The semi-analytical orbit-averaged decay curve will render here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 h-full">
                {/* Audit Title block */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`h-5 w-5 ${auditResult.compliance_status === 'PASSED' ? 'text-emerald-400' : 'text-red-400'}`} />
                    <h3 className="font-bold text-sm tracking-wider text-slate-100 uppercase">Audit Completed</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-bold font-mono tracking-wider uppercase
                    ${auditResult.compliance_status === 'PASSED' 
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-red-950 text-red-400 border border-red-500/20'
                    }`}
                  >
                    STATUS: {auditResult.compliance_status}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0">
                  {/* Left sub-column: report details */}
                  <div className="flex flex-col gap-4 justify-between">
                    <div className="flex flex-col gap-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        FAA/FCC 5-Year Compliance Statement
                      </div>
                      <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl font-mono text-[11px] text-slate-350 leading-relaxed whitespace-pre-line border-t-2 border-t-purple-500">
                        {auditResult.audit_report_text}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl grid grid-cols-3 gap-3 font-mono text-[10px] text-slate-400">
                      <div>
                        <span className="text-slate-600 block uppercase">DECAY TIME</span>
                        <span className="text-slate-200 font-bold text-xs mt-0.5">
                          {auditResult.decay_time_years ? `${auditResult.decay_time_years.toFixed(2)} yrs` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 block uppercase">ATM ENTRY</span>
                        <span className={`font-bold text-xs mt-0.5 ${auditResult.deorbit_occurred ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {auditResult.deorbit_occurred ? "Yes (<80km)" : "No"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-655 block uppercase">SOLAR SCENARIO</span>
                        <span className="text-purple-400 font-bold text-xs mt-0.5 uppercase">
                          {auditResult.solar_scenario}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right sub-column: Canvas chart */}
                  <div className="flex flex-col gap-3 min-h-[250px]">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide font-mono">
                      Decay Trajectory (Altitude vs Years)
                    </div>
                    <div className="flex-1 bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex items-center justify-center relative">
                      <canvas 
                        id="deorbitChartCanvas" 
                        width="300" 
                        height="200" 
                        className="w-full h-full max-h-[300px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
