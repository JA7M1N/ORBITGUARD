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
}

export const CompliancePage: React.FC<CompliancePageProps> = ({ selectedConjunction }) => {
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
    <div className="flex flex-col xl:flex-row gap-6 w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
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
                    className="flex items-center justify-center gap-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-emerald-400 p-1.5 rounded transition-colors"
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
                <span className="text-slate-600 block">FILING ID</span>
                <span className="text-slate-300 font-bold"># {filingResult.id}</span>
              </div>
              <div>
                <span className="text-slate-600 block">STATUS</span>
                <span className="text-emerald-400 font-bold uppercase">{filingResult.status}</span>
              </div>
              <div>
                <span className="text-slate-600 block">SUBMITTED AT</span>
                <span className="text-slate-300">{new Date(filingResult.submitted_at).toLocaleTimeString()}</span>
              </div>
              <div>
                <span className="text-slate-600 block">SERVER TARGET</span>
                <span className="text-blue-400 truncate block" title={filingResult.pdf_path}>INSPACE-CAM-2026.pdf</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
