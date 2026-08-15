import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from skyfield.api import load, EarthSatellite

from backend.db.connection import get_db
from backend.db.models import ConjunctionEvent, Satellite, ManeuverNegotiation
from orbital_mechanics.foster_elrod import calculate_foster_elrod
from orbital_mechanics.data_exporter import generate_realistic_covariance

router = APIRouter(prefix="/api/negotiations", tags=["negotiations"])


class ProposeManeuverRequest(BaseModel):
    operator_role: str = Field(..., description="'primary' or 'secondary'")
    dv_radial: float = Field(..., description="Delta-V Radial component in m/s")
    dv_in_track: float = Field(..., description="Delta-V In-Track component in m/s")
    dv_cross_track: float = Field(..., description="Delta-V Cross-Track component in m/s")
    lead_time_seconds: float = Field(3600.0, description="Maneuver lead time before TCA in seconds")


class ResolveNegotiationRequest(BaseModel):
    operator_role: str = Field(..., description="'primary' or 'secondary'")
    action: str = Field(..., description="'approve' or 'reject'")


def apply_cw_maneuver(
    r_primary: np.ndarray, 
    v_primary: np.ndarray, 
    r_secondary: np.ndarray, 
    v_secondary: np.ndarray, 
    dv_ric: list[float], 
    dt_sec: float, 
    role: str
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Applies a Delta-V burn in the Radial/In-track/Cross-track (RIC) frame dt_sec seconds 
    before TCA, and propagates the orbital state modification to TCA using the Clohessy-Wiltshire 
    relative motion model.
    
    dv_ric: delta-v components in meters per second.
    """
    # Convert delta-V from m/s to km/s
    dv = np.array(dv_ric) / 1000.0
    
    # Target orbit frequency (n)
    mu = 3.986004418e5  # Earth gravitational constant (km^3/s^2)
    r_norm = np.linalg.norm(r_primary)
    n = np.sqrt(mu / (r_norm**3))
    
    # State transition matrices mapping Delta-V to position shift (dr) and velocity shift (dv_tca)
    t = dt_sec
    nt = n * t
    sin_nt = np.sin(nt)
    cos_nt = np.cos(nt)
    
    # Phi_rv (position response to velocity burn)
    Phi_rv = np.zeros((3, 3))
    Phi_rv[0, 0] = sin_nt / n
    Phi_rv[0, 1] = 2.0 * (1.0 - cos_nt) / n
    Phi_rv[1, 0] = 2.0 * (cos_nt - 1.0) / n
    Phi_rv[1, 1] = (4.0 * sin_nt - 3.0 * n * t) / n
    Phi_rv[2, 2] = sin_nt / n
    
    # Phi_vv (velocity response to velocity burn)
    Phi_vv = np.zeros((3, 3))
    Phi_vv[0, 0] = cos_nt
    Phi_vv[0, 1] = 2.0 * sin_nt
    Phi_vv[1, 0] = -2.0 * sin_nt
    Phi_vv[1, 1] = 4.0 * cos_nt - 3.0
    Phi_vv[2, 2] = cos_nt
    
    # Relational offsets in local RIC frame at TCA
    dr_ric = Phi_rv.dot(dv)
    dv_ric_tca = Phi_vv.dot(dv)
    
    # Compute RIC unit vectors for ECI transformation
    r_unit = r_primary / r_norm
    h_vec = np.cross(r_primary, v_primary)
    h_unit = h_vec / np.linalg.norm(h_vec)
    i_unit = np.cross(h_unit, r_unit)  # Along-track direction
    
    # Rotation matrix mapping RIC -> ECI
    R_ric_to_eci = np.column_stack((r_unit, i_unit, h_unit))
    
    dr_eci = R_ric_to_eci.dot(dr_ric)
    dv_eci = R_ric_to_eci.dot(dv_ric_tca)
    
    if role == "primary":
        r_p_new = r_primary + dr_eci
        v_p_new = v_primary + dv_eci
        r_s_new = r_secondary
        v_s_new = v_secondary
    else:
        r_p_new = r_primary
        v_p_new = v_primary
        r_s_new = r_secondary + dr_eci
        v_s_new = v_secondary + dv_eci
        
    return r_p_new, v_p_new, r_s_new, v_s_new


async def get_spacecraft_states(db: AsyncSession, conj: ConjunctionEvent):
    """
    Propagates primary and secondary spacecraft orbits to TCA using SGP4 to retrieve 
    exact position and velocity vectors.
    """
    ts = load.timescale(builtin=True)
    
    # Fetch satellites TLEs
    p_res = await db.execute(select(Satellite).filter_by(norad_id=conj.primary_norad))
    s_res = await db.execute(select(Satellite).filter_by(norad_id=conj.secondary_norad))
    p_sat = p_res.scalar_one_or_none()
    s_sat = s_res.scalar_one_or_none()
    
    if not (p_sat and s_sat and p_sat.tle1 and s_sat.tle1):
        # Fallback to relative motion vectors if TLEs unavailable
        r_p = np.array([4200.0, 3100.0, 5000.0])
        v_p = np.array([5.5, 3.2, 4.1])
        r_s = r_p + np.array([conj.radial or 0.1, conj.in_track or 0.15, conj.cross_track or 0.2])
        v_s = v_p + np.array([0.01, -0.02, 0.015])
        return r_p, v_p, r_s, v_s
        
    try:
        sat_p = EarthSatellite(p_sat.tle1, p_sat.tle2, p_sat.name, ts)
        sat_s = EarthSatellite(s_sat.tle1, s_sat.tle2, s_sat.name, ts)
        
        tca_utc = conj.tca
        if tca_utc.tzinfo is None:
            tca_utc = tca_utc.replace(tzinfo=timezone.utc)
            
        t_sf = ts.from_datetime(tca_utc)
        g_p = sat_p.at(t_sf)
        g_s = sat_s.at(t_sf)
        
        return g_p.position.km, g_p.velocity.km_per_s, g_s.position.km, g_s.velocity.km_per_s
    except Exception:
        # Graceful fallback
        r_p = np.array([4200.0, 3100.0, 5000.0])
        v_p = np.array([5.5, 3.2, 4.1])
        r_s = r_p + np.array([conj.radial or 0.1, conj.in_track or 0.15, conj.cross_track or 0.2])
        v_s = v_p + np.array([0.01, -0.02, 0.015])
        return r_p, v_p, r_s, v_s


@router.get("/{conjunction_id}")
async def get_maneuver_negotiation_details(conjunction_id: int, db: AsyncSession = Depends(get_db)):
    """
    Fetches the collaborative maneuver negotiation details for a conjunction event.
    Creates a new negotiation record if none exists.
    """
    # 1. Verify conjunction exists
    conj_res = await db.execute(select(ConjunctionEvent).filter_by(id=conjunction_id))
    conj = conj_res.scalar_one_or_none()
    if not conj:
        raise HTTPException(status_code=404, detail="Conjunction event not found.")
        
    # 2. Get negotiation session
    neg_res = await db.execute(select(ManeuverNegotiation).filter_by(conjunction_id=conjunction_id))
    neg = neg_res.scalar_one_or_none()
    
    if not neg:
        neg = ManeuverNegotiation(
            conjunction_id=conjunction_id,
            status="Proposed",
            primary_maneuver=None,
            primary_status="Pending",
            secondary_maneuver=None,
            secondary_status="Pending"
        )
        db.add(neg)
        await db.commit()
        await db.refresh(neg)
        
    return neg


@router.post("/{conjunction_id}/propose")
async def propose_collaborative_maneuver(
    conjunction_id: int, 
    payload: ProposeManeuverRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Proposes a collision avoidance maneuver burn. Recalculates the post-maneuver 
    miss distance and Pc to verify the efficacy of the proposed trajectory shift.
    """
    # 1. Fetch conjunction and negotiation records
    conj_res = await db.execute(select(ConjunctionEvent).filter_by(id=conjunction_id))
    conj = conj_res.scalar_one_or_none()
    if not conj:
        raise HTTPException(status_code=404, detail="Conjunction event not found.")
        
    neg_res = await db.execute(select(ManeuverNegotiation).filter_by(conjunction_id=conjunction_id))
    neg = neg_res.scalar_one_or_none()
    if not neg:
        neg = ManeuverNegotiation(
            conjunction_id=conjunction_id,
            status="Proposed",
            primary_maneuver=None,
            primary_status="Pending",
            secondary_maneuver=None,
            secondary_status="Pending"
        )
        db.add(neg)
        await db.flush()
        
    # 2. Execute Clohessy-Wiltshire propagation to determine post-burn orbit parameters
    r_p, v_p, r_s, v_s = await get_spacecraft_states(db, conj)
    
    dv_ric = [payload.dv_radial, payload.dv_in_track, payload.dv_cross_track]
    r_p_new, v_p_new, r_s_new, v_s_new = apply_cw_maneuver(
        r_p, v_p, r_s, v_s, 
        dv_ric, 
        payload.lead_time_seconds, 
        payload.operator_role
    )
    
    # 3. Recalculate Miss Distance & Pc
    new_miss_distance = float(np.linalg.norm(r_p_new - r_s_new))
    
    cov_p = generate_realistic_covariance(r_p, v_p)
    cov_s = generate_realistic_covariance(r_s, v_s)
    new_pc = calculate_foster_elrod(
        (r_p_new, v_p_new), 
        (r_s_new, v_s_new), 
        cov_p, cov_s, 
        hbr=10.0
    )
    
    # 4. Save proposal metrics
    proposal_data = {
        "dv_radial": payload.dv_radial,
        "dv_in_track": payload.dv_in_track,
        "dv_cross_track": payload.dv_cross_track,
        "lead_time_seconds": payload.lead_time_seconds,
        "recalculated_miss_distance_km": new_miss_distance,
        "recalculated_pc": new_pc
    }
    
    if payload.operator_role == "primary":
        neg.primary_maneuver = proposal_data
        neg.primary_status = "Approved"
        neg.secondary_status = "Pending"  # Requires review
    else:
        neg.secondary_maneuver = proposal_data
        neg.secondary_status = "Approved"
        neg.primary_status = "Pending"
        
    neg.status = "Under Review"
    neg.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(neg)
    
    return {
        "negotiation": neg,
        "recalculated_miss_distance_km": new_miss_distance,
        "recalculated_pc": new_pc
    }


@router.post("/{conjunction_id}/resolve")
async def resolve_collaborative_negotiation(
    conjunction_id: int,
    payload: ResolveNegotiationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Approves or rejects the counterpart's maneuver proposal.
    If agreed by both operators, resolves the conjunction risk status.
    """
    neg_res = await db.execute(select(ManeuverNegotiation).filter_by(conjunction_id=conjunction_id))
    neg = neg_res.scalar_one_or_none()
    if not neg:
        raise HTTPException(status_code=404, detail="Negotiation session not found.")
        
    conj_res = await db.execute(select(ConjunctionEvent).filter_by(id=conjunction_id))
    conj = conj_res.scalar_one_or_none()
    
    if payload.action == "approve":
        if payload.operator_role == "primary":
            neg.primary_status = "Approved"
        else:
            neg.secondary_status = "Approved"
            
        # If both approved, agreement reached
        if neg.primary_status == "Approved" and neg.secondary_status == "Approved":
            neg.status = "Accepted"
            if conj:
                conj.compliance_status = "Resolved"
    else:
        # Rejection
        neg.status = "Rejected"
        if payload.operator_role == "primary":
            neg.primary_status = "Declined"
        else:
            neg.secondary_status = "Declined"
            
    neg.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(neg)
    
    return neg
