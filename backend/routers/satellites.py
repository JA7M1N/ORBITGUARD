from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.connection import get_db
from backend.db.models import Satellite, StateVector, ConjunctionEvent, ReentryAlert, ComplianceFiling

router = APIRouter(prefix="/api/satellites", tags=["satellites"])

@router.get("")
async def get_satellites(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=500, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for satellite name or operator"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves a paginated list of active satellites in OrbitGuard.
    Supports searching by name and operator.
    """
    offset = (page - 1) * limit
    
    # Construct base query
    query = select(Satellite)
    if search:
        query = query.where(
            or_(
                Satellite.name.ilike(f"%{search}%"),
                Satellite.operator.ilike(f"%{search}%")
            )
        )
        
    # Count total satellites matching criteria
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total_count = total_result.scalar_one()

    # Get paginated results
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    satellites = result.scalars().all()
    
    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "results": [
            {
                "norad_id": sat.norad_id,
                "name": sat.name,
                "operator": sat.operator,
                "type": sat.type,
                "tle1": sat.tle1,
                "tle2": sat.tle2,
                "updated_at": sat.updated_at
            }
            for sat in satellites
        ]
    }

@router.get("/{norad_id}/trajectory")
async def get_satellite_trajectory(
    norad_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves the 48-hour future state vectors for a satellite.
    Used to render trajectories on the 3D globe visualization.
    """
    # Check if satellite exists
    sat_result = await db.execute(select(Satellite).filter_by(norad_id=norad_id))
    sat = sat_result.scalar_one_or_none()
    if not sat:
        raise HTTPException(status_code=404, detail=f"Satellite with NORAD ID {norad_id} not found.")

    # Retrieve associated state vectors sorted chronologically by epoch
    query = select(StateVector).filter_by(norad_id=norad_id).order_by(StateVector.epoch.asc())
    result = await db.execute(query)
    vectors = result.scalars().all()
    
    return {
        "norad_id": norad_id,
        "name": sat.name,
        "trajectory": [
            {
                "epoch": sv.epoch,
                "position": [sv.position_x, sv.position_y, sv.position_z],
                "velocity": [sv.velocity_x, sv.velocity_y, sv.velocity_z]
            }
            for sv in vectors
        ]
    }

@router.get("/czml")
async def get_satellites_czml(
    limit: int = Query(20, ge=1, le=5000, description="Limit the number of satellites in the CZML output"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns satellite trajectories formatted in standard CZML (Cesium Language)
    format to be loaded directly by the Resium 3D Globe in the frontend.
    """
    # Fetch a proportional mix of payloads, debris, and rocket bodies to guarantee they are all represented on the globe
    debris_lim = max(2, limit // 5)
    rb_lim = max(2, limit // 5)
    payload_lim = max(1, limit - debris_lim - rb_lim)
    
    debris_res = await db.execute(select(Satellite).filter(Satellite.type == "Debris").limit(debris_lim))
    debris_sats = debris_res.scalars().all()
    
    rb_res = await db.execute(select(Satellite).filter(Satellite.type == "Rocket Body").limit(rb_lim))
    rb_sats = rb_res.scalars().all()
    
    payload_res = await db.execute(select(Satellite).filter(Satellite.type == "Payload").limit(payload_lim))
    payload_sats = payload_res.scalars().all()
    
    sats = debris_sats + rb_sats + payload_sats
    
    if not sats:
        return []

    # Determine clock intervals (48 hours forward from current time)
    start_time = datetime.now(timezone.utc)
    end_time = start_time + timedelta(hours=48)
    
    start_iso = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_iso = end_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    interval = f"{start_iso}/{end_iso}"

    # First packet: Document clock configuration
    czml = [
        {
            "id": "document",
            "name": "OrbitGuard Live Satellite Tracks",
            "version": "1.0",
            "clock": {
                "interval": interval,
                "currentTime": start_iso,
                "multiplier": 60,
                "range": "LOOP",
                "step": "SYSTEM_CLOCK_MULTIPLIER"
            }
        }
    ]

    for sat in sats:
        # Get its state vectors
        sv_res = await db.execute(
            select(StateVector)
            .filter_by(norad_id=sat.norad_id)
            .order_by(StateVector.epoch.asc())
        )
        vectors = sv_res.scalars().all()
        if not vectors:
            continue
            
        color_rgba = [59, 130, 246, 255] # Default Blue for general payloads
        billboard_uri = "https://img.icons8.com/fluency/48/satellite.png"
        model_uri = "/models/satellite.glb"
        if sat.type and "debris" in sat.type.lower():
            color_rgba = [239, 68, 68, 255] # Red for debris
            billboard_uri = "https://img.icons8.com/color/48/asteroid.png"
            model_uri = "/models/debris.glb"
        elif sat.type and "rocket body" in sat.type.lower():
            color_rgba = [245, 158, 11, 255] # Amber for spent stages
            billboard_uri = "https://img.icons8.com/fluency/48/rocket.png"
            model_uri = "/models/rocket.glb"
            
        cartesian_coords = []
        for sv in vectors:
            iso_epoch = sv.epoch.strftime("%Y-%m-%dT%H:%M:%SZ")
            # Convert database km positions and velocity to Cesium metric cartesian coordinate Hermite states
            cartesian_coords.extend([
                iso_epoch,
                sv.position_x * 1000.0,
                sv.position_y * 1000.0,
                sv.position_z * 1000.0,
                sv.velocity_x * 1000.0,
                sv.velocity_y * 1000.0,
                sv.velocity_z * 1000.0
            ])
            
        packet = {
            "id": f"sat_{sat.norad_id}",
            "name": sat.name,
            "availability": interval,
            "description": f"NORAD ID: {sat.norad_id} | Operator: {sat.operator} | Type: {sat.type}",
            "properties": {
                "type": sat.type.upper() if sat.type else "PAYLOAD"
            },
            "path": {
                "show": {
                    "boolean": False
                },
                "width": 1.5,
                "material": {
                    "solidColor": {
                        "color": {
                            "rgba": color_rgba
                        }
                    }
                },
                "leadTime": 86400,
                "trailTime": 86400
            },
            "position": {
                "interpolationAlgorithm": "HERMITE",
                "interpolationDegree": 2,
                "referenceFrame": "INERTIAL",
                "cartesian": cartesian_coords
            },
            "point": {
                "show": {
                    "boolean": True
                },
                "pixelSize": 8,
                "color": {
                    "rgba": color_rgba
                },
                "outlineColor": {
                    "rgba": [255, 255, 255, 180]
                },
                "outlineWidth": 1
            },
            "billboard": {
                "show": {
                    "boolean": False
                },
                "image": {
                    "uri": billboard_uri
                },
                "width": {
                    "number": 32
                },
                "height": {
                    "number": 32
                }
            },
            "model": {
                "show": {
                    "boolean": False
                },
                "gltf": {
                    "uri": model_uri
                },
                "minimumPixelSize": {
                    "number": 64
                },
                "maximumScale": {
                    "number": 2000
                }
            },
            "orientation": {
                "velocityReference": "#position"
            },
            "label": {
                "show": {
                    "boolean": False
                },
                "text": sat.name,
                "font": "10pt monospace",
                "fillColor": {
                    "rgba": [255, 255, 255, 255]
                },
                "outlineColor": {
                    "rgba": [0, 0, 0, 255]
                },
                "outlineWidth": 2,
                "style": "FILL_AND_OUTLINE",
                "pixelOffset": {
                    "cartesian2": [0, -40]
                },
                "horizontalOrigin": "CENTER",
                "verticalOrigin": "CENTER"
            }
        }
        czml.append(packet)
        
    return czml

@router.get("/{norad_id}/details")
async def get_satellite_details(
    norad_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns high-fidelity Keplerian elements, launch details, and close approach
    threat profiles for a specific satellite by NORAD ID.
    """
    # 1. Fetch satellite
    sat_query = select(Satellite).filter_by(norad_id=norad_id)
    sat_res = await db.execute(sat_query)
    sat = sat_res.scalar_one_or_none()
    if not sat:
        raise HTTPException(status_code=404, detail=f"Satellite with NORAD ID {norad_id} not found.")

    # 2. Extract launch details from TLE
    # TLE line 1: e.g. "1 25544U 98067A   20351.52044444..."
    # Columns 9-17 represents international designator: "98067A"
    # Year: 98 -> 1998; 21 -> 2021
    launch_designator = "Unknown"
    launch_year = "Unknown"
    
    try:
        tle_line1 = sat.tle1.strip()
        parts = tle_line1.split()
        if len(parts) >= 3:
            designator = parts[2]
            launch_designator = designator
            # Extract launch year
            yr_str = designator[:2]
            if yr_str.isdigit():
                yr = int(yr_str)
                if yr > 50:
                    launch_year = f"19{yr_str}"
                else:
                    launch_year = f"20{yr_str}"
    except Exception:
        pass

    # 3. Extract Keplerian parameters from TLE Line 2
    # Line 2 format: "2 25544  51.6467  44.5727 0002164  73.9623  34.8726 15.49280000260408"
    inclination = 0.0
    eccentricity = 0.0
    period_minutes = 0.0
    
    try:
        tle_line2 = sat.tle2.strip()
        # Parse fields based on standard TLE character offsets
        incl_str = tle_line2[8:16].strip()
        ecc_str = tle_line2[26:33].strip()
        mean_motion_str = tle_line2[52:63].strip()
        
        if incl_str:
            inclination = float(incl_str)
        if ecc_str:
            eccentricity = float(f"0.{ecc_str}")
        if mean_motion_str:
            mean_motion = float(mean_motion_str)
            if mean_motion > 0:
                period_minutes = (24.0 * 60.0) / mean_motion
    except Exception:
        pass

    # 4. Query active conjunction threat risks
    conj_query = select(ConjunctionEvent).filter(
        or_(
            ConjunctionEvent.primary_norad == norad_id,
            ConjunctionEvent.secondary_norad == norad_id
        )
    )
    conj_res = await db.execute(conj_query)
    conjunctions = conj_res.scalars().all()
    
    threats = []
    other_norad_ids = set()
    for c in conjunctions:
        other_norad = c.secondary_norad if c.primary_norad == norad_id else c.primary_norad
        other_norad_ids.add(other_norad)
        
    other_sats_map = {}
    if other_norad_ids:
        other_sats_res = await db.execute(select(Satellite).where(Satellite.norad_id.in_(list(other_norad_ids))))
        for s in other_sats_res.scalars().all():
            other_sats_map[s.norad_id] = s
            
    for c in conjunctions:
        other_norad = c.secondary_norad if c.primary_norad == norad_id else c.primary_norad
        other_sat = other_sats_map.get(other_norad)
        other_name = other_sat.name if other_sat else f"NORAD {other_norad}"
        other_type = other_sat.type if other_sat else "Unknown"
        
        threats.append({
            "event_id": c.id,
            "other_name": other_name,
            "other_norad": other_norad,
            "other_type": other_type,
            "miss_distance_km": c.miss_distance,
            "collision_probability": c.pc,
            "tca": c.tca
        })

    # 5. Query active reentry alert
    reentry_query = select(ReentryAlert).filter_by(norad_id=norad_id)
    reentry_res = await db.execute(reentry_query)
    reentry = reentry_res.scalar_one_or_none()
    
    reentry_data = None
    if reentry:
        reentry_data = {
            "current_altitude_km": reentry.current_altitude,
            "decay_rate_m_day": reentry.decay_rate,
            "eta": reentry.eta,
            "uncertainty_hours": reentry.uncertainty_hours,
            "survival_pct": reentry.survival_pct,
            "casualty_probability": reentry.casualty_probability
        }

    return {
        "norad_id": sat.norad_id,
        "name": sat.name,
        "operator": sat.operator,
        "type": sat.type,
        "launch_designator": launch_designator,
        "launch_year": launch_year,
        "orbital_elements": {
            "inclination_deg": inclination,
            "eccentricity": eccentricity,
            "orbital_period_min": round(period_minutes, 2)
        },
        "active_conjunction_risks": threats,
        "reentry_alert": reentry_data
    }

from pydantic import BaseModel

class OPMExportRequest(BaseModel):
    maneuver_dv: float

@router.post("/{norad_id}/export-opm")
async def export_satellite_opm(
    norad_id: int,
    payload: OPMExportRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generates and exports a CCSDS OPM v2.0 Key-Value Notation (KVN) text file
    containing the satellite state vector and simulated maneuver burn parameters.
    """
    # 1. Fetch satellite details
    sat_result = await db.execute(select(Satellite).filter_by(norad_id=norad_id))
    sat = sat_result.scalar_one_or_none()
    if not sat:
        raise HTTPException(status_code=404, detail=f"Satellite with NORAD ID {norad_id} not found.")

    # 2. Extract launch designator (COSPAR ID) from TLE
    object_id = "Unknown"
    try:
        tle_line1 = sat.tle1.strip()
        parts = tle_line1.split()
        if len(parts) >= 3:
            object_id = parts[2]
    except Exception:
        pass

    # 3. Retrieve the latest state vector to serve as base state
    state_vector_query = select(StateVector).filter_by(norad_id=norad_id).order_by(StateVector.epoch.desc()).limit(1)
    state_res = await db.execute(state_vector_query)
    sv = state_res.scalar_one_or_none()

    if sv:
        x = sv.position_x
        y = sv.position_y
        z = sv.position_z
        vx = sv.velocity_x
        vy = sv.velocity_y
        vz = sv.velocity_z
        epoch_str = sv.epoch.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
    else:
        # Fallback values if no state vector exists in the database
        x, y, z = 7000.0, 0.0, 0.0
        vx, vy, vz = 0.0, 7.5, 0.0
        epoch_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]

    # Convert delta-V from m/s to km/s
    dv_km_s = payload.maneuver_dv / 1000.0

    # Build CCSDS OPM KVN text
    opm_text = f"""CCSDS_OPM_VERS = 2.0
COMMENT = OrbitGuard Generated CCSDS OPM for Maneuver Execution
CREATION_DATE = {now_str}
ORIGINATOR = ORBITGUARD

META_START
OBJECT_NAME = {sat.name}
OBJECT_ID = {object_id}
CENTER_NAME = EARTH
REF_FRAME = TEME
TIME_SYSTEM = UTC
META_STOP

EPOCH = {epoch_str}
X = {x:.6f}
Y = {y:.6f}
Z = {z:.6f}
X_DOT = {vx:.9f}
Y_DOT = {vy:.9f}
Z_DOT = {vz:.9f}

COMMENT = Emergency Collision Avoidance Maneuver (CAM) Parameter Block
MAN_EPOCH_START = {now_str}
MAN_DURATION = 10.0
MAN_REF_FRAME = RIC
MAN_DV_1 = {dv_km_s:.9f}
MAN_DV_2 = 0.000000000
MAN_DV_3 = 0.000000000
"""

    headers = {
        "Content-Disposition": f"attachment; filename=CCSDS_OPM_{sat.name.replace(' ', '_')}_{norad_id}.txt"
    }
    return Response(content=opm_text, media_type="text/plain", headers=headers)


class TleImportRequest(BaseModel):
    name: Optional[str] = None
    tle1: str
    tle2: str

@router.post("/import")
async def import_satellite_tle(
    payload: TleImportRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Imports a raw TLE set for a new satellite, propagates its orbital trajectory 
    for 24 hours, runs the KD-tree screening algorithm, and returns the hazard report.
    """
    tle1 = payload.tle1.strip()
    tle2 = payload.tle2.strip()
    
    # 1. Parse NORAD ID from TLE Line 1
    try:
        # Standard TLE line 1: e.g. "1 25544U..."
        # ID is from index 2 to 7 (exclusive)
        norad_id = int(tle1[2:7].strip())
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Failed to parse NORAD catalog ID from TLE Line 1. Ensure standard 3-line or 2-line format."
        )
        
    name = payload.name.strip() if payload.name else None
    if not name:
        name = f"SELF-SERVE-SAT-{norad_id}"

    # 3. Create or update Satellite object
    sat_res = await db.execute(select(Satellite).filter_by(norad_id=norad_id))
    sat = sat_res.scalar_one_or_none()
    
    if not sat:
        sat = Satellite(
            norad_id=norad_id,
            name=name,
            operator="Self-Serve Operator",
            type="Payload",
            tle1=tle1,
            tle2=tle2,
            updated_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(sat)
    else:
        sat.name = name
        sat.tle1 = tle1
        sat.tle2 = tle2
        sat.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        
    await db.flush()

    # 4. Delete existing state vectors/conjunctions for this satellite (fresh screening)
    from sqlalchemy import delete, or_
    await db.execute(delete(StateVector).where(StateVector.norad_id == norad_id))
    await db.execute(delete(ConjunctionEvent).where(
        or_(
            ConjunctionEvent.primary_norad == norad_id,
            ConjunctionEvent.secondary_norad == norad_id
        )
    ))
    await db.commit()

    # 5. Propagate trajectory 24 hours forward (10-minute steps)
    import numpy as np
    from skyfield.api import load, EarthSatellite, wgs84
    
    ts = load.timescale(builtin=True)
    try:
        sat_model = EarthSatellite(tle1, tle2, name, ts)
        
        # Start propagation from today
        start_time = datetime.now(timezone.utc)
        time_steps = [start_time + timedelta(minutes=m) for m in range(0, 24 * 60 + 1, 10)]
        t_array = ts.from_datetimes(time_steps)
        
        geocentric = sat_model.at(t_array)
        positions = geocentric.position.km
        velocities = geocentric.velocity.km_per_s
        
        new_vectors = []
        for idx, dt in enumerate(time_steps):
            sv = StateVector(
                norad_id=norad_id,
                epoch=dt.replace(tzinfo=None),
                position_x=float(positions[0, idx]),
                position_y=float(positions[1, idx]),
                position_z=float(positions[2, idx]),
                velocity_x=float(velocities[0, idx]),
                velocity_y=float(velocities[1, idx]),
                velocity_z=float(velocities[2, idx])
            )
            new_vectors.append(sv)
            db.add(sv)
            
        await db.flush()
        
    except Exception as prop_err:
        raise HTTPException(
            status_code=400,
            detail=f"SGP4 Propagation failed for the provided TLE set: {prop_err}"
        )

    # 6. Screen close approaches using spatial KD-Tree against other state vectors in DB
    # Fetch all existing state vectors for OTHER satellites
    other_res = await db.execute(select(StateVector).where(StateVector.norad_id != norad_id))
    other_vectors = other_res.scalars().all()
    
    # Map state vectors to dict list format required by screen_conjunctions
    all_states_input = []
    for sv in new_vectors:
        all_states_input.append({
            "norad_id": norad_id,
            "epoch": sv.epoch,
            "position_x": sv.position_x,
            "position_y": sv.position_y,
            "position_z": sv.position_z,
            "velocity_x": sv.velocity_x,
            "velocity_y": sv.velocity_y,
            "velocity_z": sv.velocity_z
        })
        
    for sv in other_vectors:
        all_states_input.append({
            "norad_id": sv.norad_id,
            "epoch": sv.epoch,
            "position_x": sv.position_x,
            "position_y": sv.position_y,
            "position_z": sv.position_z,
            "velocity_x": sv.velocity_x,
            "velocity_y": sv.velocity_y,
            "velocity_z": sv.velocity_z
        })
        
    from orbital_mechanics.screening import screen_conjunctions
    from orbital_mechanics.foster_elrod import calculate_foster_elrod
    from orbital_mechanics.data_exporter import generate_realistic_covariance, compute_ric_coordinates
    
    conjunctions_detected = 0
    if len(other_vectors) > 0:
        try:
            conjs = screen_conjunctions(all_states_input, threshold_km=10.0)
            
            for c in conjs:
                r_p, v_p = c["primary_state"][0], c["primary_state"][1]
                r_s, v_s = c["secondary_state"][0], c["secondary_state"][1]
                
                cov_p = generate_realistic_covariance(r_p, v_p)
                cov_s = generate_realistic_covariance(r_s, v_s)
                
                pc_val = calculate_foster_elrod(
                    c["primary_state"], c["secondary_state"],
                    cov_p, cov_s, hbr=10.0
                )
                
                radial, in_track, cross_track = compute_ric_coordinates(r_p, v_p, r_s)
                
                db_conj = ConjunctionEvent(
                    primary_norad=c["primary_id"],
                    secondary_norad=c["secondary_id"],
                    tca=c["tca"].replace(tzinfo=None),
                    miss_distance=c["miss_distance"],
                    radial=radial,
                    in_track=in_track,
                    cross_track=cross_track,
                    pc=pc_val,
                    covariance_matrix={
                        "p_cov": cov_p.tolist(),
                        "s_cov": cov_s.tolist()
                    },
                    compliance_status="Compliance Required" if pc_val >= 1.0e-4 else "Nominal"
                )
                db.add(db_conj)
                conjunctions_detected += 1
                
        except Exception as screen_err:
            print(f"Error during TLE import screening: {screen_err}")
            
    await db.commit()
    
    return {
        "status": "success",
        "norad_id": norad_id,
        "name": name,
        "conjunctions_detected": conjunctions_detected
    }

@router.get("/{norad_id}/risk-report")
async def explain_satellite_risk(norad_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns a plain-language summary of a satellite's risk profile:
    conjunction risks, reentry decay status, and regulatory compliance status.
    """
    # 1. Fetch satellite details
    sat_result = await db.execute(select(Satellite).filter_by(norad_id=norad_id))
    sat = sat_result.scalar_one_or_none()
    if not sat:
        raise HTTPException(status_code=404, detail=f"Satellite with NORAD ID {norad_id} not found.")
        
    # 2. Get conjunctions
    conj_query = select(ConjunctionEvent).filter(
        or_(
            ConjunctionEvent.primary_norad == norad_id,
            ConjunctionEvent.secondary_norad == norad_id
        )
    )
    conj_res = await db.execute(conj_query)
    conjunctions = conj_res.scalars().all()
    
    # 3. Get reentry status
    reentry_query = select(ReentryAlert).filter_by(norad_id=norad_id)
    reentry_res = await db.execute(reentry_query)
    reentry = reentry_res.scalar_one_or_none()
    
    # 4. Get compliance status (how many filings have been made)
    comp_query = select(ComplianceFiling).filter(ComplianceFiling.satellite == sat.name)
    comp_res = await db.execute(comp_query)
    filings = comp_res.scalars().all()
    
    # 5. Build plain-language explanation
    conjunctions_count = len(conjunctions)
    critical_conjunctions = [c for c in conjunctions if c.pc >= 1e-4]
    warning_conjunctions = [c for c in conjunctions if 1e-6 <= c.pc < 1e-4]
    
    summary_parts = []
    summary_parts.append(f"Satellite {sat.name} (NORAD {sat.norad_id}) is currently cataloged as a {sat.type} operated by {sat.operator or 'Unknown'}.")
    
    # Conjunction summary
    if conjunctions_count == 0:
        summary_parts.append("There are no upcoming close approach hazards detected in the next 48 hours. Your satellite is currently in a safe orbital corridor.")
    else:
        part = f"We have identified {conjunctions_count} upcoming close approach event(s)."
        if critical_conjunctions:
            part += f" WARNING: {len(critical_conjunctions)} of these events exceed the critical safety threshold of 1 in 10,000 (Pc >= 1.0e-4) and require immediate collision avoidance maneuvers."
        elif warning_conjunctions:
            part += f" {len(warning_conjunctions)} event(s) are in the warning zone (Pc between 1.0e-6 and 1.0e-4) and should be monitored closely."
        else:
            part += " All detected events have low nominal risk levels (Pc < 1.0e-6)."
        summary_parts.append(part)
        
    # Reentry summary
    if reentry:
        reentry_parts = [
            f"Orbital Decay Alert: This satellite has dropped to an altitude of {reentry.current_altitude:.1f} km.",
            f"Due to atmospheric drag, it is decaying at a rate of {reentry.decay_rate:.2f} meters per day.",
            f"It is projected to reenter Earth's atmosphere on approximately {reentry.eta.strftime('%Y-%m-%d %H:%M UTC') if reentry.eta else 'Unknown'}.",
            f"The landing corridor is bounded with an uncertainty of +/- {reentry.uncertainty_hours:.1f} hours.",
            f"There is a {reentry.survival_pct:.1f}% chance of structural components surviving reentry, with a casualty probability estimated at {reentry.casualty_probability:.2e}."
        ]
        summary_parts.append(" ".join(reentry_parts))
    else:
        summary_parts.append("Orbit Stability: The satellite is currently in a stable orbit, with no decay warnings or reentry risks detected.")
        
    # Compliance summary
    if filings:
        summary_parts.append(f"Regulatory Filings: You have successfully submitted {len(filings)} collision avoidance filing(s) (INSPACE-CAM-2026) for review.")
    elif critical_conjunctions:
        summary_parts.append("Action Required: A critical conjunction event requires you to file a collision avoidance maneuver report (INSPACE-CAM-2026) with space regulators immediately.")
    else:
        summary_parts.append("Regulatory Compliance: No filings are currently required as there are no critical collision threats.")
        
    plain_summary = " ".join(summary_parts)
    
    # Resolve opponents details for rendering in UI
    threats = []
    for c in conjunctions:
        other_norad = c.secondary_norad if c.primary_norad == norad_id else c.primary_norad
        other_res = await db.execute(select(Satellite).filter_by(norad_id=other_norad))
        other_sat = other_res.scalar_one_or_none()
        other_name = other_sat.name if other_sat else f"NORAD {other_norad}"
        threats.append({
            "event_id": c.id,
            "other_name": other_name,
            "other_norad": other_norad,
            "miss_distance": c.miss_distance,
            "pc": c.pc,
            "tca": c.tca
        })
        
    return {
        "norad_id": sat.norad_id,
        "name": sat.name,
        "operator": sat.operator,
        "type": sat.type,
        "plain_language_explanation": plain_summary,
        "risk_metrics": {
            "total_conjunctions": conjunctions_count,
            "critical_conjunctions": len(critical_conjunctions),
            "warning_conjunctions": len(warning_conjunctions),
            "reentry_risk": "HIGH" if reentry else "NONE",
            "compliance_status": "ACTION REQUIRED" if (critical_conjunctions and not filings) else "NOMINAL"
        },
        "conjunctions": threats,
        "reentry": {
            "current_altitude": reentry.current_altitude if reentry else None,
            "eta": reentry.eta if reentry else None,
            "casualty_probability": reentry.casualty_probability if reentry else None
        }
    }

