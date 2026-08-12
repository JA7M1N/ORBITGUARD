import React from 'react';

interface BPlanePlotterProps {
  covarianceMatrix?: number[][]; // 2x2 matrix
  missDistanceVector: [number, number]; // [x, y] offsets in km
  hbr?: number; // Hard-body radius in meters
}

export const BPlanePlotter: React.FC<BPlanePlotterProps> = ({
  covarianceMatrix = [[0.18, 0.04], [0.04, 0.08]], // Default realistic 2x2 covariance in km^2
  missDistanceVector,
  hbr = 15.0 // Default 15 meters hard body radius
}) => {
  // 1. Solve eigenvalues and rotation angle for the 2D projected covariance matrix
  const [[cxx, cxy], [, cyy]] = covarianceMatrix;
  
  const mean = (cxx + cyy) / 2.0;
  const diff = (cxx - cyy) / 2.0;
  const term = Math.sqrt(diff * diff + cxy * cxy);
  
  const lambda1 = mean + term; // Eigenvalue 1 (semi-major axis squared)
  const lambda2 = mean - term; // Eigenvalue 2 (semi-minor axis squared)

  // Calculate 1-sigma standard deviation lengths in km
  const a1 = Math.sqrt(Math.max(0, lambda1));
  const b1 = Math.sqrt(Math.max(0, lambda2));

  // Calculate rotation angle in degrees
  let rotationAngle = 0;
  if (cxy !== 0) {
    rotationAngle = 0.5 * Math.atan2(2 * cxy, cxx - cyy) * (180.0 / Math.PI);
  } else if (cxx < cyy) {
    rotationAngle = 90;
  }

  // 2. Setup dynamic auto-scaling logic so elements fit beautifully
  const [xOffset, yOffset] = missDistanceVector;
  const missDistance = Math.sqrt(xOffset * xOffset + yOffset * yOffset);
  
  // Calculate viewport boundaries based on the 3-sigma ellipse size and miss offset
  const maxAxis3Sigma = 3.0 * a1;
  const maxVal = Math.max(missDistance, maxAxis3Sigma, 0.1); // minimum bounding scale
  
  // We want the elements to fit within the 400x400 SVG box (radius = 200px)
  // Leave a 20% margin to prevent clip cutoffs
  const marginMultiplier = 1.4;
  const scale = 180.0 / (maxVal * marginMultiplier); // px per km

  // Convert HBR from meters to km and then scale to pixels
  const hbrKm = hbr / 1000.0;
  const hbrPx = Math.max(4, hbrKm * scale); // Ensure it is at least visible (4px)

  // Offset point coordinates in pixels (flip Y coordinate for SVG standard viewport)
  const xOffsetPx = xOffset * scale;
  const yOffsetPx = -yOffset * scale;

  // Generate grid circles
  const gridRings = [0.25, 0.5, 0.75, 1.0].map(pct => maxVal * marginMultiplier * pct);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
      <div className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase mb-3">
        Encounter Frame 2D B-Plane Plot
      </div>

      <div className="relative w-full max-w-[340px] aspect-square">
        <svg 
          viewBox="-200 -200 400 400" 
          className="w-full h-full bg-slate-950 border border-slate-800/80 rounded-xl"
        >
          {/* A. Background Grid Lines & Rings */}
          <line x1="-200" y1="0" x2="200" y2="0" stroke="rgba(30, 41, 59, 0.6)" strokeWidth="1" strokeDasharray="3,3" />
          <line x1="0" y1="-200" x2="0" y2="200" stroke="rgba(30, 41, 59, 0.6)" strokeWidth="1" strokeDasharray="3,3" />
          
          {gridRings.map((r, i) => (
            <circle
              key={i}
              cx="0"
              cy="0"
              r={r * scale}
              fill="none"
              stroke="rgba(30, 41, 59, 0.4)"
              strokeWidth="0.8"
            />
          ))}

          {/* Grid Distance Labels */}
          {gridRings.map((r, i) => (
            <text
              key={`text-${i}`}
              x="5"
              y={-r * scale + 12}
              fill="rgba(71, 85, 105, 0.8)"
              fontSize="8"
              fontFamily="monospace"
            >
              {r.toFixed(2)} km
            </text>
          ))}

          {/* B. Uncertainty Covariance Ellipses (1-sigma, 2-sigma, 3-sigma) */}
          {/* 3-sigma (Red Alert Zone) */}
          <ellipse
            cx="0"
            cy="0"
            rx={3 * a1 * scale}
            ry={3 * b1 * scale}
            transform={`rotate(${-rotationAngle})`}
            fill="rgba(239, 68, 68, 0.03)"
            stroke="rgba(239, 68, 68, 0.25)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />

          {/* 2-sigma (Amber Alert Zone) */}
          <ellipse
            cx="0"
            cy="0"
            rx={2 * a1 * scale}
            ry={2 * b1 * scale}
            transform={`rotate(${-rotationAngle})`}
            fill="rgba(245, 158, 11, 0.03)"
            stroke="rgba(245, 158, 11, 0.35)"
            strokeWidth="1.2"
          />

          {/* 1-sigma (Nominal Zone) */}
          <ellipse
            cx="0"
            cy="0"
            rx={a1 * scale}
            ry={b1 * scale}
            transform={`rotate(${-rotationAngle})`}
            fill="rgba(59, 130, 246, 0.05)"
            stroke="rgba(59, 130, 246, 0.5)"
            strokeWidth="1.5"
          />

          {/* C. Primary Satellite (Origin Center Point + Hard-Body Radius) */}
          {/* HBR Protection Circle */}
          <circle
            cx="0"
            cy="0"
            r={hbrPx}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="#3b82f6"
            strokeWidth="1"
          />
          {/* Center Point */}
          <circle
            cx="0"
            cy="0"
            r="3"
            fill="#60a5fa"
          />

          {/* D. Secondary Satellite Offset Point */}
          {/* Projected Vector line from origin */}
          <line
            x1="0"
            y1="0"
            x2={xOffsetPx}
            y2={yOffsetPx}
            stroke="rgba(244, 63, 94, 0.4)"
            strokeWidth="1.5"
            strokeDasharray="2,2"
          />
          {/* Secondary Point Blinker wrapper */}
          <g>
            <circle
              cx={xOffsetPx}
              cy={yOffsetPx}
              r="7"
              fill="rgba(244, 63, 94, 0.2)"
              stroke="#f43f5e"
              strokeWidth="1"
            />
            <circle
              cx={xOffsetPx}
              cy={yOffsetPx}
              r="2"
              fill="#fda4af"
            />
          </g>
        </svg>

        {/* Floating Legends */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 font-mono text-[9px] text-slate-500 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span>Primary Sat (HBR)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
            <span>Secondary Sat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-3 inline-block bg-orange-400"></span>
            <span>Covariance (2-sigma)</span>
          </div>
        </div>
      </div>

      {/* Plot Statistics */}
      <div className="w-full flex justify-between gap-4 mt-3 font-mono text-[10px] text-slate-400 border-t border-slate-900 pt-3">
        <div>
          <span className="text-slate-600">Rotation:</span> {rotationAngle.toFixed(1)}°
        </div>
        <div>
          <span className="text-slate-600">1σ Cov:</span> {a1.toFixed(3)} x {b1.toFixed(3)} km
        </div>
      </div>
    </div>
  );
};
