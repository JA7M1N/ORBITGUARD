export interface Satellite {
  norad_id: number;
  name: string;
  operator: string;
  type: string;
  tle1: string;
  tle2: string;
  updated_at: string;
}

export interface StateVector {
  epoch: string;
  position: [number, number, number]; // [x, y, z] in km
  velocity: [number, number, number]; // [vx, vy, vz] in km/s
}

export interface SatelliteTrajectory {
  norad_id: number;
  name: string;
  trajectory: StateVector[];
}

export interface ConjunctionEvent {
  id: number;
  primary_norad: number;
  primary_name: string;
  secondary_norad: number;
  secondary_name: string;
  tca: string;
  miss_distance: number;
  pc: number;
  compliance_status: string;
}

export interface ConjunctionDetails extends ConjunctionEvent {
  relative_vectors: {
    radial: number;
    in_track: number;
    cross_track: number;
  };
  covariance_matrix: any;
  primary: {
    norad_id: number;
    name: string;
    operator: string;
  };
  secondary: {
    norad_id: number;
    name: string;
    operator: string;
  };
  explain?: {
    miss_distance_km: number;
    sigma_major: number;
    sigma_minor: number;
    pc_terms: {
      u: number;
      alpha: number;
      beta: number;
    };
  };
}

export interface ReentryCandidate {
  norad_id: number;
  name: string;
  current_altitude: number;
  decay_rate: number;
  eta: string;
  uncertainty_hours: number;
  survival_pct: number;
  casualty_probability: number;
}

export interface SwarmLog {
  percentage: number;
  agent: string;
  log: string;
  timestamp: string;
}

export interface SolarData {
  current: {
    f10_7: number;
    ap: number;
    updated_at: string;
  };
  alert_metrics: {
    level: string;
    description: string;
    quiet_baseline_sfu: number;
  };
  trend_history: {
    date: string;
    f10_7: number;
    ap: number;
  }[];
}

export interface ComplianceFiling {
  id: number;
  operator: string;
  satellite: string;
  tca: string;
  form_data: {
    primary_norad: number;
    secondary_norad: number;
    miss_distance: number;
    pc: number;
    briefing: string;
  };
  pdf_path: string;
  status: string;
  submitted_at: string;
}
