from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.connection import get_db
from backend.db.models import Satellite, StateVector, ConjunctionEvent, ReentryAlert

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
    limit: int = Query(20, ge=1, le=100, description="Limit the number of satellites in the CZML output"),
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
            # Convert database km positions to Cesium metric cartesian coordinates
            cartesian_coords.extend([
                iso_epoch,
                sv.position_x * 1000.0,
                sv.position_y * 1000.0,
                sv.position_z * 1000.0
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
    for c in conjunctions:
        # Resolve opposing satellite name
        other_norad = c.secondary_norad if c.primary_norad == norad_id else c.primary_norad
        other_query = select(Satellite).filter_by(norad_id=other_norad)
        other_res = await db.execute(other_query)
        other_sat = other_res.scalar_one_or_none()
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
