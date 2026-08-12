import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Database, Info, Shield, AlertTriangle, ChevronRight, Loader2, Compass, AlertOctagon } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Satellite {
  norad_id: number;
  name: string;
  operator: string;
  type: string;
}

interface SatelliteDetails {
  norad_id: number;
  name: string;
  operator: string;
  type: string;
  launch_designator: string;
  launch_year: string;
  orbital_elements: {
    inclination_deg: number;
    eccentricity: number;
    orbital_period_min: number;
  };
  active_conjunction_risks: Array<{
    event_id: number;
    other_name: string;
    other_norad: number;
    other_type: string;
    miss_distance_km: number;
    collision_probability: number;
    tca: string;
  }>;
  reentry_alert: {
    current_altitude_km: number;
    decay_rate_m_day: number;
    eta: string;
    uncertainty_hours: number;
    survival_pct: number;
    casualty_probability: number;
  } | null;
}

export const SatelliteCatalogPage: React.FC = () => {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<string>('ALL');
  const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null);
  const [details, setDetails] = useState<SatelliteDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // 1. Fetch satellite list on mount
  useEffect(() => {
    const fetchSats = async () => {
      try {
        setLoadingList(true);
        const response = await axios.get(`${API_BASE_URL}/api/satellites?limit=120`);
        if (response.data && response.data.results) {
          setSatellites(response.data.results);
          // Auto select first satellite if available
          if (response.data.results.length > 0) {
            setSelectedNoradId(response.data.results[0].norad_id);
          }
        }
      } catch (err) {
        console.error("Error loading satellites list:", err);
      } finally {
        setLoadingList(false);
      }
    };
    fetchSats();
  }, []);

  // 2. Fetch detailed satellite info when selectedNoradId changes
  useEffect(() => {
    if (!selectedNoradId) {
      setDetails(null);
      return;
    }
    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        const response = await axios.get(`${API_BASE_URL}/api/satellites/${selectedNoradId}/details`);
        setDetails(response.data);
      } catch (err) {
        console.error("Error loading satellite details:", err);
        setDetails(null);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedNoradId]);

  // 3. Filter satellites list based on search query and selected country operator
  const filteredSats = satellites.filter(sat => {
    // Country / Space agency operator check
    if (selectedOperator !== 'ALL' && sat.operator !== selectedOperator) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (q === '') return true;
    return (
      sat.name.toLowerCase().includes(q) ||
      sat.norad_id.toString().includes(q) ||
      sat.operator.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[calc(100vh-140px)] md:min-h-[calc(100vh-120px)] select-none">
      {/* LEFT SECTION: Directory List */}
      <div className="w-full lg:w-96 flex flex-col gap-4 p-5 glassmorphism rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="h-5 w-5 text-blue-400" />
          <h3 className="font-bold text-sm tracking-wider text-slate-100 uppercase">Satellite Directory</h3>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, NORAD, operator..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-650" />
        </div>

        {/* Country/Operator Dropdown Filter */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Filter by Operator / Country</span>
          <select
            value={selectedOperator}
            onChange={(e) => {
              setSelectedOperator(e.target.value);
              // Auto-select the first satellite matching this country filter if available
              const matches = satellites.filter(s => e.target.value === 'ALL' || s.operator === e.target.value);
              if (matches.length > 0) {
                setSelectedNoradId(matches[0].norad_id);
              }
            }}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-350 focus:border-blue-500 focus:outline-none cursor-pointer transition-colors font-mono"
          >
            <option value="ALL">All Operators / Countries</option>
            <option value="ISRO">🇮🇳 India (ISRO)</option>
            <option value="NASA">🇺🇸 USA (NASA)</option>
            <option value="SpaceX">🇺🇸 USA (SpaceX)</option>
            <option value="ESA">🇪🇺 Europe (ESA)</option>
            <option value="Roscosmos">🇷🇺 Russia (Roscosmos)</option>
          </select>
        </div>

        {/* Quick-Select Hotkeys */}
        <div className="flex flex-col gap-1 pb-1 border-b border-slate-900/60">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Quick-Select Hotkeys</span>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            <button
              onClick={() => {
                setSelectedOperator('ALL');
                setSearchQuery('');
                setSelectedNoradId(25544);
              }}
              className="px-2.5 py-1 bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 text-purple-400 font-mono text-[9px] font-bold uppercase rounded-lg transition-colors"
            >
              🚀 ISS (ZARYA)
            </button>
            <button
              onClick={() => {
                setSelectedOperator('ALL');
                setSearchQuery('');
                setSelectedNoradId(900);
              }}
              className="px-2.5 py-1 bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-400 font-mono text-[9px] font-bold uppercase rounded-lg transition-colors"
            >
              ⚠️ CALSPHERE 1
            </button>
            <button
              onClick={() => {
                setSelectedOperator('ALL');
                setSearchQuery('');
                setSelectedNoradId(902);
              }}
              className="px-2.5 py-1 bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-400 font-mono text-[9px] font-bold uppercase rounded-lg transition-colors"
            >
              🛰️ CALSPHERE 2
            </button>
            <button
              onClick={() => {
                setSelectedOperator('ALL');
                setSearchQuery('');
                setSelectedNoradId(1361);
              }}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-350 font-mono text-[9px] font-bold uppercase rounded-lg transition-colors"
            >
              🛰️ LCS 1
            </button>
          </div>
        </div>

        {/* Catalog List */}
        <div className="flex-1 overflow-y-auto max-h-[500px] lg:max-h-[calc(100vh-320px)] flex flex-col gap-1.5 pr-1">
          {loadingList ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-xs font-mono text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <span>PARSING ACTIVE CATALOG...</span>
            </div>
          ) : filteredSats.length === 0 ? (
            <div className="text-center py-10 font-mono text-xs text-slate-500">
              No matching satellites found for this country.
            </div>
          ) : (
            filteredSats.map(sat => {
              const isSelected = selectedNoradId === sat.norad_id;
              return (
                <button
                  key={sat.norad_id}
                  onClick={() => setSelectedNoradId(sat.norad_id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left font-mono transition-all duration-300 group
                    ${isSelected 
                      ? 'bg-blue-600/10 border-blue-500/30 text-slate-100 shadow-[0_0_15px_rgba(59,130,246,0.05)]' 
                      : 'bg-slate-900/30 border-slate-900/40 hover:bg-slate-900/50 hover:border-slate-800 text-slate-350'
                    }`}
                >
                  <div className="flex flex-col gap-1 truncate max-w-[200px]">
                    <span className={`text-xs font-bold ${isSelected ? 'text-blue-400' : 'text-slate-200'}`}>
                      {sat.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      NORAD {sat.norad_id} | {sat.operator}
                    </span>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5
                    ${isSelected ? 'text-blue-400' : 'text-slate-600'}`} 
                  />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT SECTION: Detailed Analysis Dashboard */}
      <div className="flex-1 flex flex-col gap-5 p-5 glassmorphism rounded-2xl border border-slate-800/80 overflow-y-auto">
        {loadingDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center py-32 gap-3 text-xs font-mono text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            <span>SOLVING KEPLERIAN PARAMETERS & RISK MATRICES...</span>
          </div>
        ) : details ? (
          <div className="flex flex-col gap-6">
            {/* Header info */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600/10 p-2.5 rounded-xl border border-purple-500/20 flex items-center justify-center">
                  <Compass className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider font-mono">
                    {details.name}
                  </h2>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    REGISTRY OPERATOR: <span className="text-blue-400 font-bold">{details.operator}</span> | TYPE: {details.type}
                  </p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-850 px-4 py-2 rounded-xl font-mono text-xs text-slate-350">
                NORAD CATALOG ID: <span className="text-slate-100 font-bold">{details.norad_id}</span>
              </div>
            </div>

            {/* Grid metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-xl font-mono flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Launch Year</span>
                <span className="text-lg font-bold text-slate-200">{details.launch_year}</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-xl font-mono flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Launch Designator</span>
                <span className="text-lg font-bold text-slate-200">{details.launch_designator}</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-xl font-mono flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Inclination Angle</span>
                <span className="text-lg font-bold text-slate-200">{details.orbital_elements.inclination_deg.toFixed(4)}°</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-xl font-mono flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Orbital Period</span>
                <span className="text-lg font-bold text-slate-200">{details.orbital_elements.orbital_period_min} mins</span>
              </div>
            </div>

            {/* Orbit parameters details */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <Info className="h-4 w-4 text-purple-400" />
                <span>Standard Keplerian Elements Description</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div className="flex flex-col gap-2 p-4 bg-slate-900/20 border border-slate-900 rounded-xl">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5 mb-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>ELEMENT</span>
                    <span>VALUE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Eccentricity</span>
                    <span className="text-slate-300 font-bold">{details.orbital_elements.eccentricity.toFixed(7)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Trajectory Type</span>
                    <span className="text-slate-300 font-semibold">
                      {details.orbital_elements.eccentricity < 0.005 ? 'Near-Circular' : 'Elliptical'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-4 bg-slate-900/20 border border-slate-900 rounded-xl">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5 mb-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>PARAMETER</span>
                    <span>VALUE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mean Motion</span>
                    <span className="text-slate-300 font-bold">
                      {((24 * 60) / details.orbital_elements.orbital_period_min).toFixed(4)} orbits/day
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Orbit Category</span>
                    <span className="text-slate-350">Low Earth Orbit (LEO)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Conjunction threats */}
            <div className="flex flex-col gap-3.5 border-t border-slate-800/80 pt-5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Pending Conjunction Risk Registry</span>
              </div>

              {details.active_conjunction_risks.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-950/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  <div className="font-mono text-xs">
                    <p className="font-bold">OPERATIONAL STATUS: NOMINAL</p>
                    <p className="text-[10px] text-emerald-500/70 mt-0.5">No immediate close-approach threats or debris intersections detected in the database.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {details.active_conjunction_risks.map(threat => {
                    const isHigh = threat.collision_probability >= 1e-4;
                    return (
                      <div 
                        key={threat.event_id} 
                        className={`flex flex-col gap-2 p-4 rounded-xl border font-mono text-xs
                          ${isHigh 
                            ? 'bg-red-950/20 border-red-500/30 text-red-400 animate-pulse'
                            : 'bg-amber-950/10 border-amber-500/20 text-amber-400'
                          }`}
                      >
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-1.5">
                          <span className="font-bold uppercase tracking-wider text-[10px]">
                            {isHigh ? "🚨 High Risk Conjunction" : "⚠️ Warning Alert"}
                          </span>
                          <span className="font-bold px-2 py-0.5 bg-slate-950 border border-slate-900 rounded text-[10px]">
                            Pc: {threat.collision_probability.toExponential(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">THREAT TARGET</span>
                          <span className="font-bold text-slate-200">
                            {threat.other_name} ({threat.other_type})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">NORAD ID</span>
                          <span className="text-slate-300 font-semibold">{threat.other_norad}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">MISS DISTANCE</span>
                          <span className="font-semibold">{threat.miss_distance_km.toFixed(3)} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">TCA EPOCH</span>
                          <span className="text-[10px]">{new Date(threat.tca).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reentry Warning Alert */}
            <div className="flex flex-col gap-3.5 border-t border-slate-800/80 pt-5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <AlertOctagon className="h-4 w-4 text-red-500" />
                <span>Active Reentry / Orbital Decay Alert</span>
              </div>

              {!details.reentry_alert ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-950/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  <div className="font-mono text-xs">
                    <p className="font-bold">DECAY PROFILE: SAFE</p>
                    <p className="text-[10px] text-emerald-500/70 mt-0.5">Orbit altitude is stable. No imminent orbital decay or uncontrolled reentry detected.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-4 p-4 bg-red-950/15 border border-red-500/20 rounded-xl font-mono text-xs text-red-400 animate-pulse">
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-red-950/40 pb-2 mb-1">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-red-400">
                        🚨 UNCONTROLLED REENTRY WARNING
                      </span>
                      <span className="font-bold px-2 py-0.5 bg-red-950/40 border border-red-800/30 rounded text-[10px]">
                        ALTITUDE: {details.reentry_alert.current_altitude_km.toFixed(1)} km
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">DECAY RATE</span>
                      <span className="font-bold text-slate-200">{details.reentry_alert.decay_rate_m_day.toFixed(2)} m/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">PREDICTED TCA/ETA</span>
                      <span className="font-bold text-slate-200">{new Date(details.reentry_alert.eta).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">UNCERTAINTY CORRIDOR</span>
                      <span className="font-semibold text-slate-350">± {details.reentry_alert.uncertainty_hours} hours</span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-2 border-t md:border-t-0 md:border-l border-red-950/45 pt-3 md:pt-0 md:pl-4">
                    <div className="flex items-center justify-between border-b border-red-950/40 pb-2 mb-1">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-red-400">
                        CASUALTY & RISK ASSESSMENT
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">SURVIVAL RATIO</span>
                      <span className="font-bold text-slate-200">{(details.reentry_alert.survival_pct).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CASUALTY PROBABILITY</span>
                      <span className="font-bold text-slate-200">{details.reentry_alert.casualty_probability.toExponential(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-32 text-xs font-mono text-slate-500">
            <span>SELECT A SATELLITE TO VIEW DETAILED SPECS</span>
          </div>
        )}
      </div>
    </div>
  );
};
