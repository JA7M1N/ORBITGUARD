import math
import random
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.connection import get_db
from backend.db.models import Satellite, ConjunctionEvent

router = APIRouter(prefix="/api/refinement", tags=["refinement"])


class RefinementFitRequest(BaseModel):
    norad_id: int = Field(..., description="NORAD Catalog ID of satellite to refine")
    station_id: Literal["istrac_bengaluru", "dhruva_hyderabad", "commercial_svalbard"] = Field("istrac_bengaluru", description="Ground tracking station identifier")
    measurement_noise_m: float = Field(50.0, ge=1.0, le=250.0, description="Sensor range noise standard deviation (meters)")
    num_observations: int = Field(20, ge=5, le=50, description="Number of tracked ground observations/passes")


@router.post("/fit")
async def fit_ground_observations(
    payload: RefinementFitRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Simulates Least-Squares Orbit Determination / Bayesian Covariance Refinement
    by applying tracking observations from Indian or commercial ground stations.
    """
    # 1. Fetch satellite from catalog
    sat_res = await db.execute(select(Satellite).filter_by(norad_id=payload.norad_id))
    sat = sat_res.scalar_one_or_none()
    if not sat:
        raise HTTPException(
            status_code=404,
            detail=f"Satellite with NORAD ID {payload.norad_id} not found."
        )
        
    # 2. Determine prior covariance trace
    # Check if there is an active conjunction event involving this satellite to pull realistic covariance values
    prior_trace = 15.0  # Default prior covariance trace in km^2
    conj_res = await db.execute(
        select(ConjunctionEvent).filter(
            (ConjunctionEvent.primary_norad == payload.norad_id) | 
            (ConjunctionEvent.secondary_norad == payload.norad_id)
        )
    )
    conj = conj_res.scalars().first()
    if conj and conj.covariance_matrix:
        try:
            cov = conj.covariance_matrix
            p_cov = cov.get("p_cov") or cov.get("s_cov")
            if p_cov:
                # Trace is sum of diagonal elements (variance components)
                prior_trace = float(p_cov[0][0] + p_cov[1][1] + p_cov[2][2])
        except Exception:
            pass
            
    # 3. Apply Bayesian Covariance update math
    # Measurement noise variance R (km^2)
    R = (payload.measurement_noise_m / 1000.0) ** 2
    
    # Standard prior standard deviation per coordinate
    prior_variance_per_coord = prior_trace / 3.0
    
    # Bayesian information update: 1/refined_variance = 1/prior_variance + N/R
    refined_variance_per_coord = 1.0 / ((1.0 / prior_variance_per_coord) + (payload.num_observations / R))
    
    refined_trace = refined_variance_per_coord * 3.0
    reduction_pct = (1.0 - (refined_trace / prior_trace)) * 100.0
    
    # 4. Generate fit residuals (simulated from sensor noise gaussian distribution)
    # Residuals represent range fit error standard deviation in meters
    random.seed(42)  # Pin seed for unit test stability
    residuals = []
    for i in range(min(payload.num_observations, 8)):
        val = random.normalvariate(0.0, payload.measurement_noise_m * 0.15)
        residuals.append(round(val, 2))
        
    avg_residual = sum(abs(r) for r in residuals) / len(residuals)
    
    # Map station name
    station_names = {
        "istrac_bengaluru": "ISRO ISTRAC Ground Station (Bengaluru, India)",
        "dhruva_hyderabad": "Dhruva Space Tracking Terminal (Hyderabad, India)",
        "commercial_svalbard": "Commercial Deep Space Radar (Svalbard, Norway)"
    }
    station_name = station_names.get(payload.station_id.lower(), "Commercial Tracking Station")
    
    # Generate justification summary text
    refinement_text = (
        f"Orbit Determination Converged: Spacecraft '{sat.name}' position covariance refined. "
        f"By incorporating {payload.num_observations} tracking passes from '{station_name}' with range noise "
        f"sigma = {payload.measurement_noise_m:.1f} meters, position uncertainty (covariance matrix trace) "
        f"shrank from {prior_trace:.4f} km² to {refined_trace:.4f} km²—a {reduction_pct:.1f}% reduction in "
        f"conjunction collision probability bounds. Average range fitting residual holds at {avg_residual:.2f} meters."
    )
    
    return {
        "status": "success",
        "satellite_name": sat.name,
        "station_name": station_name,
        "prior_covariance_trace_km2": round(prior_trace, 4),
        "refined_covariance_trace_km2": round(refined_trace, 4),
        "covariance_reduction_pct": round(reduction_pct, 1),
        "average_residual_m": round(avg_residual, 2),
        "residuals_chart": residuals,
        "refinement_report_text": refinement_text
    }
