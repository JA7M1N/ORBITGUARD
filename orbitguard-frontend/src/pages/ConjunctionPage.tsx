import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { BPlanePlotter } from '../components/BPlanePlotter';
import { 
  AlertTriangle, 
  ShieldAlert, 
  ChevronRight, 
  ChevronDown,
  HelpCircle,
  FileText, 
  CheckCircle, 
  Navigation,
  Activity,
  Terminal
} from 'lucide-react';
import type { ConjunctionEvent, ConjunctionDetails } from '../types';

interface TcaCountdownProps {
  tcaString: string;
}

const TcaCountdown: React.FC<TcaCountdownProps> = ({ tcaString }) => {
  const [timeLeft, setTimeLeft] = useState<string>("Calculating...");
  const [isUrgent, setIsUrgent] = useState<boolean>(false);

  useEffect(() => {
    const tcaEpoch = new Date(tcaString).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const diff = tcaEpoch - now;

      if (diff <= 0) {
        const elapsed = Math.abs(diff);
        const hours = Math.floor(elapsed / 3600000);
        const mins = Math.floor((elapsed % 3600000) / 60000);
        const secs = Math.floor((elapsed % 60000) / 1000);
        setTimeLeft(`ENCOUNTER PASSED (+${hours}h ${mins}m ${secs}s)`);
        setIsUrgent(false);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      const ms = Math.floor((diff % 1000) / 10);

      const formatted = `${hours.toString().padStart(2, '0')}h : ${mins.toString().padStart(2, '0')}m : ${secs.toString().padStart(2, '0')}s : ${ms.toString().padStart(2, '0')}ms`;
      setTimeLeft(formatted);
      setIsUrgent(diff < 6 * 3600000);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 40);
    return () => clearInterval(interval);
  }, [tcaString]);

  return (
    <div className={`p-4 rounded-xl border flex flex-col items-center justify-center font-mono transition-all duration-300
      ${isUrgent 
        ? 'bg-red-950/20 border-red-500/30 text-red-400 shadow-md shadow-red-500/5 pulse-red' 
        : 'bg-slate-900/40 border-slate-800/80 text-slate-200'
      }`}
    >
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${isUrgent ? 'bg-red-500 animate-ping' : 'bg-slate-500'}`} />
        Time to Closest Approach (TCA)
      </div>
      <div className="text-xl md:text-2xl font-bold font-mono tracking-widest">{timeLeft}</div>
    </div>
  );
};

const computeChanPc = (
  cov: number[][] | undefined,
  r_B: [number, number],
  hbr: number = 15.0
): number => {
  const matrix = cov || [[0.18, 0.04], [0.04, 0.08]];
  const [[cxx, cxy], [, cyy]] = matrix;
  
  const mean = (cxx + cyy) / 2.0;
  const diff = (cxx - cyy) / 2.0;
  const term = Math.sqrt(diff * diff + cxy * cxy);
  const lambda1 = mean + term;
  const lambda2 = mean - term;
  
  const sigma_x2 = Math.max(1e-30, lambda1);
  const sigma_y2 = Math.max(1e-30, lambda2);
  const sigma_x = Math.sqrt(sigma_x2);
  const sigma_y = Math.sqrt(sigma_y2);
  
  let theta = 0;
  if (cxy !== 0) {
    theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  } else if (cxx < cyy) {
    theta = Math.PI / 2.0;
  }
  
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  
  const x_m = r_B[0] * cosT + r_B[1] * sinT;
  const y_m = -r_B[0] * sinT + r_B[1] * cosT;
  
  const R_km = hbr / 1000.0;
  const sigma = Math.sqrt(sigma_x * sigma_y);
  
  if (sigma < 1e-9) {
    const miss = Math.sqrt(r_B[0] * r_B[0] + r_B[1] * r_B[1]);
    return miss <= R_km ? 1.0 : 0.0;
  }
  
  const u = (x_m / sigma_x) ** 2 + (y_m / sigma_y) ** 2;
  const v_dist = Math.sqrt(u) * sigma;
  const alpha = v_dist / sigma;
  const beta = R_km / sigma;
  
  if (alpha === 0 && beta === 0) return 0.0;
  
  const x = alpha * beta;
  const factor = Math.exp(-0.5 * (alpha - beta) ** 2);
  const tol = 1e-15;
  const max_terms = 100;
  
  const bessel_ive = (k: number, val: number): number => {
    if (val < 0) return 0;
    let sum = 0;
    const x2_4 = (val * val) / 4.0;
    
    let fact_m = 1;
    let fact_k_m = 1;
    for (let i = 1; i <= k; i++) fact_k_m *= i;
    
    for (let m = 0; m < 30; m++) {
      const term_val = (Math.pow(val / 2, k) * Math.pow(x2_4, m)) / (fact_m * fact_k_m);
      sum += term_val;
      if (term_val < 1e-16 * sum) break;
      fact_m *= (m + 1);
      fact_k_m *= (k + m + 1);
    }
    return sum * Math.exp(-val);
  };
  
  let Pc = 0.0;
  if (beta >= alpha) {
    const ratio = beta > 0.0 ? alpha / beta : 0.0;
    let term_sum = 0.0;
    for (let k = 0; k < max_terms; k++) {
      const term_val = Math.pow(ratio, k) * bessel_ive(k, x);
      term_sum += term_val;
      if (term_val < tol * term_sum && k > 5) break;
    }
    Pc = 1.0 - factor * term_sum;
  } else {
    const ratio = beta / alpha;
    let term_sum = 0.0;
    for (let k = 1; k < max_terms; k++) {
      const term_val = Math.pow(ratio, k) * bessel_ive(k, x);
      term_sum += term_val;
      if (term_val < tol * term_sum && k > 5) break;
    }
    Pc = factor * term_sum;
  }
  
  return Math.max(0.0, Math.min(1.0, Pc));
};

interface ConjunctionPageProps {
  onInitiateFiling: (eventId: string, satelliteName: string) => void;
}

export const ConjunctionPage: React.FC<ConjunctionPageProps> = ({ onInitiateFiling }) => {
  const [conjunctions, setConjunctions] = useState<ConjunctionEvent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<ConjunctionDetails | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  const [radialBurn, setRadialBurn] = useState<number>(0);
  const [inTrackBurn, setInTrackBurn] = useState<number>(0);
  const [crossTrackBurn, setCrossTrackBurn] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [threatFilter, setThreatFilter] = useState<'all' | 'critical' | 'warning' | 'nominal'>('all');
  const [isWhyPcExpanded, setIsWhyPcExpanded] = useState<boolean>(false);

  useEffect(() => {
    setRadialBurn(0);
    setInTrackBurn(0);
    setCrossTrackBurn(0);
    setNegFeedback(null);
    setNegRadial(0);
    setNegInTrack(0);
    setNegCrossTrack(0);
  }, [selectedId]);

  const [negotiation, setNegotiation] = useState<any | null>(null);
  const [role, setRole] = useState<'primary' | 'secondary'>('primary');
  const [negRadial, setNegRadial] = useState<number>(0);
  const [negInTrack, setNegInTrack] = useState<number>(0);
  const [negCrossTrack, setNegCrossTrack] = useState<number>(0);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState<boolean>(false);
  const [negFeedback, setNegFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setNegotiation(null);
      return;
    }
    const fetchNegotiation = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/negotiations/${selectedId}`);
        setNegotiation(response.data);
      } catch (err) {
        console.error("Error fetching negotiation details:", err);
      }
    };
    fetchNegotiation();
  }, [selectedId]);

  // Automated debounced recalculation for operator collaborative sliders
  useEffect(() => {
    if (!selectedId) return;
    if (negRadial === 0 && negInTrack === 0 && negCrossTrack === 0) return;

    const timer = setTimeout(async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/negotiations/${selectedId}/propose`, {
          operator_role: role,
          dv_radial: negRadial,
          dv_in_track: negInTrack,
          dv_cross_track: negCrossTrack,
          lead_time_seconds: 3600.0
        });
        setNegotiation(response.data.negotiation);
        setNegFeedback(`Live Recalculation (Debounced): Pc = ${response.data.recalculated_pc.toExponential(2)} | Miss Distance = ${response.data.recalculated_miss_distance_km.toFixed(3)} km`);
      } catch (err: any) {
        console.error("Error in debounced recalculation:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [negRadial, negInTrack, negCrossTrack, selectedId, role]);

  const handleProposeManeuver = async () => {
    if (!selectedId) return;
    setIsSubmittingProposal(true);
    setNegFeedback(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/negotiations/${selectedId}/propose`, {
        operator_role: role,
        dv_radial: negRadial,
        dv_in_track: negInTrack,
        dv_cross_track: negCrossTrack,
        lead_time_seconds: 3600.0
      });
      setNegotiation(response.data.negotiation);
      setNegFeedback(`Proposal verification completed! Post-Maneuver Pc: ${response.data.recalculated_pc.toExponential(2)} | Miss Distance: ${response.data.recalculated_miss_distance_km.toFixed(3)} km`);
    } catch (err: any) {
      console.error("Error submitting proposal:", err);
      setNegFeedback(err.response?.data?.detail || "Failed to submit proposal.");
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleResolveNegotiation = async (action: 'approve' | 'reject') => {
    if (!selectedId) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/api/negotiations/${selectedId}/resolve`, {
        operator_role: role,
        action
      });
      setNegotiation(response.data);
      if (response.data.status === 'Accepted') {
        setNegFeedback("Maneuver protocol agreed! Conjunction hazard status: RESOLVED.");
        const listRes = await axios.get(`${API_BASE_URL}/api/conjunctions`);
        if (listRes.data && listRes.data.results) {
          setConjunctions(listRes.data.results);
        }
      } else {
        setNegFeedback(`Proposal review submitted: ${action.toUpperCase()}D.`);
      }
    } catch (err: any) {
      console.error("Error resolving negotiation:", err);
      setNegFeedback(err.response?.data?.detail || "Failed to resolve negotiation.");
    }
  };

  const x_base = details?.relative_vectors?.cross_track || 0;
  const y_base = details?.relative_vectors?.radial || 0;
  const radialNew = y_base + (8.0 * radialBurn) + (18.0 * inTrackBurn);
  const crossTrackNew = x_base + (12.0 * crossTrackBurn);
  const newMissDistance = Math.sqrt(radialNew * radialNew + crossTrackNew * crossTrackNew);
  const newPc = details ? computeChanPc(details.covariance_matrix?.p_cov, [crossTrackNew, radialNew], 15.0) : 0;

  const filteredConjunctions = conjunctions.filter(conj => {
    const matchesSearch = 
      conj.primary_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conj.secondary_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesThreat = true;
    if (threatFilter === 'critical') {
      matchesThreat = conj.pc >= 1e-4;
    } else if (threatFilter === 'warning') {
      matchesThreat = conj.pc >= 1e-6 && conj.pc < 1e-4;
    } else if (threatFilter === 'nominal') {
      matchesThreat = conj.pc < 1e-6;
    }
    
    return matchesSearch && matchesThreat;
  });

  // 1. Fetch active conjunctions list
  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoadingList(true);
        const response = await axios.get(`${API_BASE_URL}/api/conjunctions`);
        setConjunctions(response.data);
        if (response.data.length > 0) {
          setSelectedId(response.data[0].id);
        }
      } catch (e) {
        console.error("Error fetching conjunctions list:", e);
      } finally {
        setLoadingList(false);
      }
    };
    fetchList();
  }, []);

  // 2. Fetch specific conjunction details when selection changes
  useEffect(() => {
    if (selectedId === null) return;
    
    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        const response = await axios.get(`${API_BASE_URL}/api/conjunctions/${selectedId}`);
        setDetails(response.data);
      } catch (e) {
        console.error(`Error fetching conjunction details for ID ${selectedId}:`, e);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedId]);

  // Determine threat level color class
  const getThreatBadge = (pc: number) => {
    if (pc >= 1e-4) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-red-950/40 text-red-400 border border-red-500/30">
          <ShieldAlert className="h-3 w-3 pulse-red" />
          Critical
        </span>
      );
    } else if (pc >= 1e-6) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-950/40 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="h-3 w-3 pulse-amber" />
          Warning
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-slate-900 text-slate-400 border border-slate-800">
          Nominal
        </span>
      );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
      {/* LEFT COLUMN: Conjunction list pane */}
      <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 p-4 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
        <div>
          <h3 className="font-bold text-sm tracking-wider text-slate-100 uppercase mb-1">Active Conjunctions</h3>
          <p className="text-[10px] text-slate-500 font-medium">SORTED BY COLLISION PROBABILITY (PC)</p>
        </div>

        {/* Filters and Search box */}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Search satellite..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-850 text-xs px-3 py-2.5 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
          />
          <select
            value={threatFilter}
            onChange={(e) => setThreatFilter(e.target.value as any)}
            className="w-full bg-slate-900/60 border border-slate-850 text-[10px] px-3 py-2 rounded-xl text-slate-300 focus:outline-none focus:border-blue-500 transition-colors font-mono cursor-pointer"
          >
            <option value="all">ALL THREAT RATINGS</option>
            <option value="critical">CRITICAL ONLY (Pc ≥ 1e-4)</option>
            <option value="warning">WARNING ONLY (1e-6 ≤ Pc &lt; 1e-4)</option>
            <option value="nominal">NOMINAL ONLY (Pc &lt; 1e-6)</option>
          </select>
        </div>

        {loadingList ? (
          <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-500">
            LOADING EVENTS ACTIVE REGISTER...
          </div>
        ) : conjunctions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 gap-2">
            <CheckCircle className="h-10 w-10 text-emerald-500/40" />
            <h4 className="text-sm font-semibold text-slate-300">All Systems Clear</h4>
            <p className="text-xs max-w-[200px]">No orbital conjunction events currently exceed proximity baselines.</p>
          </div>
          ) : filteredConjunctions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-505 gap-2">
              <AlertTriangle className="h-10 w-10 text-slate-700 animate-pulse" />
              <h4 className="text-sm font-semibold text-slate-400 font-mono">No Matching Events</h4>
              <p className="text-xs max-w-[200px] text-slate-500">No conjunctions match your active search term or threat filter.</p>
            </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredConjunctions.map((conj) => {
              const isSelected = selectedId === conj.id;
              return (
                <button
                  key={conj.id}
                  onClick={() => setSelectedId(conj.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 flex items-center justify-between group
                    ${isSelected 
                      ? 'bg-blue-600/10 border-blue-500/30 text-slate-100 shadow-md shadow-blue-500/5' 
                      : 'bg-slate-950/20 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-semibold text-xs tracking-wide truncate text-slate-200 group-hover:text-slate-100">
                      {conj.primary_name} vs {conj.secondary_name}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px] text-slate-500">
                      <span>Miss: {conj.miss_distance.toFixed(3)} km</span>
                      <span>Pc: {conj.pc.toExponential(2)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {getThreatBadge(conj.pc)}
                    <ChevronRight className={`h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5
                      ${isSelected ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`} 
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Selected Event Details & B-Plane Plotter */}
      <div className="flex-1 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
        {loadingDetails ? (
          <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-500">
            LOADING EVENT HIGH-FIDELITY TELEMETRY...
          </div>
        ) : !details ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
            <AlertTriangle className="h-10 w-10 text-slate-600" />
            <p className="text-xs font-mono">Select a conjunction from the list to display details.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Header Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-100">
                  {details.primary.name} <span className="text-slate-500 font-normal">vs</span> {details.secondary.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  TCA: {new Date(details.tca).toLocaleString()} UTC
                </p>
              </div>
              <div className="shrink-0">
                {getThreatBadge(details.pc)}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Left detail attributes */}
              <div className="flex flex-col gap-5">
                <TcaCountdown tcaString={details.tca} />

                {/* Core Parameters cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Miss Distance</div>
                    <div className="text-xl font-mono font-bold text-slate-200">{details.miss_distance.toFixed(3)} km</div>
                  </div>
                  <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Collision Probability</div>
                    <div className="text-xl font-mono font-bold text-red-400">{details.pc.toExponential(4)}</div>
                  </div>
                </div>

                {/* Relative Vectors Grid */}
                <div className="p-4 bg-slate-900/30 border border-slate-800/60 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-blue-400" />
                    Projected Relative Vectors (RIC Frame)
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      <div className="text-[9px] text-slate-500 mb-0.5">RADIAL</div>
                      <div className="font-semibold text-slate-300">{(details.relative_vectors?.radial || 0).toFixed(3)} km</div>
                    </div>
                    <div className="p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      <div className="text-[9px] text-slate-500 mb-0.5">IN-TRACK</div>
                      <div className="font-semibold text-slate-300">{(details.relative_vectors?.in_track || 0).toFixed(3)} km</div>
                    </div>
                    <div className="p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                      <div className="text-[9px] text-slate-500 mb-0.5">CROSS-TRACK</div>
                      <div className="font-semibold text-slate-300">{(details.relative_vectors?.cross_track || 0).toFixed(3)} km</div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Explainable Pc Panel */}
                {details.explain && (
                  <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setIsWhyPcExpanded(!isWhyPcExpanded)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider focus:outline-none cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 text-blue-450">
                        <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
                        Why this Pc? (Explainable Math)
                      </span>
                      {isWhyPcExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                    </button>
                    
                    {isWhyPcExpanded && (
                      <div className="flex flex-col gap-3 font-mono text-[10px] text-slate-300 border-t border-slate-850 pt-3">
                        <div className="flex justify-between py-1 border-b border-slate-800/20">
                          <span className="text-slate-500">B-PLANE MISS DISTANCE:</span>
                          <span className="font-semibold text-slate-200">{(details.explain.miss_distance_km * 1000).toFixed(1)} m</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/20">
                          <span className="text-slate-500">UNCERTAINTY MAJOR AXIS (σ_major):</span>
                          <span className="font-semibold text-slate-200">{(details.explain.sigma_major * 1000).toFixed(1)} m</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/20">
                          <span className="text-slate-500">UNCERTAINTY MINOR AXIS (σ_minor):</span>
                          <span className="font-semibold text-slate-200">{(details.explain.sigma_minor * 1000).toFixed(1)} m</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/20">
                          <span className="text-slate-500">MAHALANOBIS SPATIAL OFFSET (u):</span>
                          <span className="font-semibold text-slate-200 font-bold">{details.explain.pc_terms.u.toFixed(4)}</span>
                        </div>
                        <p className="text-[9px] text-slate-450 leading-relaxed font-sans mt-1">
                          The collision probability (Pc) is solved analytically using Chan's Rician series in the 2D B-plane encounter frame. With a miss distance of {(details.explain.miss_distance_km * 1000).toFixed(0)}m relative to a combined major uncertainty of ±{(details.explain.sigma_major * 1000).toFixed(0)}m, the offset lies well within the high-probability hazard zone, yielding Pc = {details.pc.toExponential(2)}.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Collaborative Maneuver Coordinator Card */}
                {negotiation && (
                  <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl flex flex-col gap-4 relative">
                    <div className="text-[10px] font-bold text-purple-400 uppercase flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Terminal className="h-3.5 w-3.5" />
                        Collaborative Maneuver Coordinator
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-semibold font-mono tracking-wider uppercase
                        ${negotiation.status === 'Accepted' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                          negotiation.status === 'Rejected' ? 'bg-red-950 text-red-400 border border-red-500/20' :
                          'bg-amber-950 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        Status: {negotiation.status}
                      </span>
                    </div>

                    <p className="text-[9px] text-slate-400 leading-relaxed font-sans">
                      Verify and coordinate avoidance burns collaboratively with counter-operator. Propose RIC Delta-V parameters, run Clohessy-Wiltshire verification, and sign consensus filings.
                    </p>

                    {/* Operator selector role for mock demo purposes */}
                    <div className="flex gap-2 p-1 bg-slate-950/60 rounded-lg border border-slate-900">
                      <button
                        onClick={() => { setRole('primary'); setNegFeedback(null); }}
                        className={`flex-1 py-1 text-center font-mono text-[9px] font-bold rounded cursor-pointer transition-colors
                          ${role === 'primary' ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20' : 'text-slate-500'}`}
                      >
                        ROLE: PRIMARY OPERATOR ({details.primary.operator})
                      </button>
                      <button
                        onClick={() => { setRole('secondary'); setNegFeedback(null); }}
                        className={`flex-1 py-1 text-center font-mono text-[9px] font-bold rounded cursor-pointer transition-colors
                          ${role === 'secondary' ? 'bg-purple-600/15 text-purple-400 border border-purple-500/20' : 'text-slate-500'}`}
                      >
                        ROLE: COUNTERPART ({details.secondary.operator})
                      </button>
                    </div>

                    {/* Proposed burns details columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[9px]">
                      {/* Primary proposal details */}
                      <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-900 flex flex-col gap-1.5">
                        <div className="text-[8px] font-bold text-slate-500 uppercase">Primary Proposal</div>
                        {negotiation.primary_maneuver ? (
                          <div className="flex flex-col gap-1 text-slate-350">
                            <div>Radial: <span className="text-slate-200 font-semibold">{negotiation.primary_maneuver.dv_radial.toFixed(2)} m/s</span></div>
                            <div>In-Track: <span className="text-slate-200 font-semibold">{negotiation.primary_maneuver.dv_in_track.toFixed(2)} m/s</span></div>
                            <div>Cross-Track: <span className="text-slate-200 font-semibold">{negotiation.primary_maneuver.dv_cross_track.toFixed(2)} m/s</span></div>
                            <div className="mt-1 text-[8px] text-emerald-500">Sign-off: {negotiation.primary_status}</div>
                          </div>
                        ) : (
                          <div className="text-slate-600 italic py-2">No proposal submitted.</div>
                        )}
                      </div>

                      {/* Secondary proposal details */}
                      <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-900 flex flex-col gap-1.5">
                        <div className="text-[8px] font-bold text-slate-500 uppercase">Counterpart Proposal</div>
                        {negotiation.secondary_maneuver ? (
                          <div className="flex flex-col gap-1 text-slate-350">
                            <div>Radial: <span className="text-slate-200 font-semibold">{negotiation.secondary_maneuver.dv_radial.toFixed(2)} m/s</span></div>
                            <div>In-Track: <span className="text-slate-200 font-semibold">{negotiation.secondary_maneuver.dv_in_track.toFixed(2)} m/s</span></div>
                            <div>Cross-Track: <span className="text-slate-200 font-semibold">{negotiation.secondary_maneuver.dv_cross_track.toFixed(2)} m/s</span></div>
                            <div className="mt-1 text-[8px] text-emerald-500">Sign-off: {negotiation.secondary_status}</div>
                          </div>
                        ) : (
                          <div className="text-slate-600 italic py-2">No proposal submitted.</div>
                        )}
                      </div>
                    </div>

                    {/* Propose a burn form section */}
                    {negotiation.status !== 'Accepted' && (
                      <div className="flex flex-col gap-3 border-t border-slate-850 pt-3">
                        <div className="text-[8px] font-bold text-slate-500 uppercase font-mono">Propose Delta-V Maneuver Burn</div>
                        
                        <div className="flex flex-col gap-2 font-mono text-[9px] text-slate-400">
                          <div className="flex justify-between items-center gap-4">
                            <span>Radial Burn: {negRadial.toFixed(1)} m/s</span>
                            <input
                              type="range"
                              min="-10.0"
                              max="10.0"
                              step="0.5"
                              value={negRadial}
                              onChange={(e) => setNegRadial(parseFloat(e.target.value))}
                              className="w-32 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                            />
                          </div>
                          <div className="flex justify-between items-center gap-4">
                            <span>In-Track Burn: {negInTrack.toFixed(1)} m/s</span>
                            <input
                              type="range"
                              min="-10.0"
                              max="10.0"
                              step="0.5"
                              value={negInTrack}
                              onChange={(e) => setNegInTrack(parseFloat(e.target.value))}
                              className="w-32 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                            />
                          </div>
                          <div className="flex justify-between items-center gap-4">
                            <span>Cross-Track Burn: {negCrossTrack.toFixed(1)} m/s</span>
                            <input
                              type="range"
                              min="-10.0"
                              max="10.0"
                              step="0.5"
                              value={negCrossTrack}
                              onChange={(e) => setNegCrossTrack(parseFloat(e.target.value))}
                              className="w-32 accent-purple-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                            />
                          </div>
                        </div>

                        <button
                          onClick={handleProposeManeuver}
                          disabled={isSubmittingProposal}
                          className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-slate-100 text-[10px] font-bold rounded-lg cursor-pointer font-sans transition-all"
                        >
                          {isSubmittingProposal ? "Propagating CW equations..." : "Propose and Recalculate Risk Profile"}
                        </button>

                        {/* Sign-off controls: Approve/Reject counterpart proposal */}
                        {((role === 'primary' && negotiation.secondary_maneuver) || 
                          (role === 'secondary' && negotiation.primary_maneuver)) && (
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleResolveNegotiation('approve')}
                              className="flex-1 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-450 border border-emerald-500/20 text-[9px] font-bold rounded-lg cursor-pointer font-sans transition-all"
                            >
                              Approve Partner Maneuver Plan
                            </button>
                            <button
                              onClick={() => handleResolveNegotiation('reject')}
                              className="flex-1 py-1.5 bg-red-600/15 hover:bg-red-600/30 text-red-450 border border-red-500/20 text-[9px] font-bold rounded-lg cursor-pointer font-sans transition-all"
                            >
                              Decline & Propose Counter
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {negFeedback && (
                      <div className="p-3 bg-purple-950/20 border border-purple-500/25 text-purple-400 rounded-lg font-mono text-[9px] leading-relaxed">
                        {negFeedback}
                      </div>
                    )}
                  </div>
                )}

                {/* Avoidance Maneuver Planner Card (Interactive Sliders) */}
                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl flex flex-col gap-4">
                  <div className="text-[10px] font-bold text-blue-400 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Navigation className="h-3.5 w-3.5" />
                      Maneuver Burn Planner
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRadialBurn(0);
                        setInTrackBurn(0);
                        setCrossTrackBurn(0);
                      }}
                      className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded transition-colors font-mono font-semibold"
                    >
                      Reset Sliders
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-3 font-mono text-[11px] text-slate-400">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>RADIAL BURN (ΔVr)</span>
                        <span className={radialBurn === 0 ? "text-slate-500" : radialBurn > 0 ? "text-blue-400 font-bold" : "text-amber-500 font-bold"}>
                          {radialBurn > 0 ? `+${radialBurn.toFixed(2)}` : radialBurn.toFixed(2)} m/s
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="-2.0" 
                        max="2.0" 
                        step="0.05" 
                        value={radialBurn}
                        onChange={(e) => setRadialBurn(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>IN-TRACK BURN (ΔVt)</span>
                        <span className={inTrackBurn === 0 ? "text-slate-500" : inTrackBurn > 0 ? "text-blue-400 font-bold" : "text-amber-500 font-bold"}>
                          {inTrackBurn > 0 ? `+${inTrackBurn.toFixed(2)}` : inTrackBurn.toFixed(2)} m/s
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="-2.0" 
                        max="2.0" 
                        step="0.05" 
                        value={inTrackBurn}
                        onChange={(e) => setInTrackBurn(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>CROSS-TRACK BURN (ΔVn)</span>
                        <span className={crossTrackBurn === 0 ? "text-slate-500" : crossTrackBurn > 0 ? "text-blue-400 font-bold" : "text-amber-500 font-bold"}>
                          {crossTrackBurn > 0 ? `+${crossTrackBurn.toFixed(2)}` : crossTrackBurn.toFixed(2)} m/s
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="-2.0" 
                        max="2.0" 
                        step="0.05" 
                        value={crossTrackBurn}
                        onChange={(e) => setCrossTrackBurn(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-lg flex flex-col gap-1.5 font-mono text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">NEW MISS DISTANCE:</span>
                      <span className="text-slate-200 font-bold text-xs">{newMissDistance.toFixed(3)} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">NEW PROBABILITY (Pc):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 font-bold text-xs">{newPc.toExponential(4)}</span>
                        {getThreatBadge(newPc)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Regulatory filing button */}
                <button
                  onClick={() => onInitiateFiling(String(details.id), details.primary.name)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-slate-100 rounded-xl text-sm font-semibold tracking-wide transition-all shadow-lg shadow-blue-600/10"
                >
                  <FileText className="h-4.5 w-4.5" />
                  Initiate IN-SPACe CAM Filing
                </button>
              </div>

              {/* Right B-Plane visualization plot */}
              <div className="flex items-center justify-center">
                <BPlanePlotter
                  covarianceMatrix={details.covariance_matrix?.p_cov}
                  missDistanceVector={[crossTrackNew, radialNew]}
                  hbr={15.0}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
