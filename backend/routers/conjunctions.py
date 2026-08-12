import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.connection import get_db
from backend.db.models import ConjunctionEvent, Satellite

router = APIRouter(prefix="/api/conjunctions", tags=["conjunctions"])

@router.get("")
async def get_conjunctions(db: AsyncSession = Depends(get_db)):
    """
    Retrieves all active conjunction events (close approaches) sorted by 
    collision probability (Pc) descending (highest hazard level first).
    """
    # Query conjunction events sorted by Pc descending
    query = select(ConjunctionEvent).order_by(ConjunctionEvent.pc.desc())
    result = await db.execute(query)
    events = result.scalars().all()
    
    # We want to resolve names of primary and secondary satellites as well.
    # To keep it efficient, we resolve them in one go or map after.
    # A quick way is to query names for norad_ids.
    norad_ids = set()
    for ev in events:
        norad_ids.add(ev.primary_norad)
        norad_ids.add(ev.secondary_norad)
        
    names_map = {}
    if norad_ids:
        sats_result = await db.execute(select(Satellite).where(Satellite.norad_id.in_(list(norad_ids))))
        for sat in sats_result.scalars().all():
            names_map[sat.norad_id] = sat.name

    return [
        {
            "id": ev.id,
            "primary_norad": ev.primary_norad,
            "primary_name": names_map.get(ev.primary_norad, "Unknown"),
            "secondary_norad": ev.secondary_norad,
            "secondary_name": names_map.get(ev.secondary_norad, "Unknown"),
            "tca": ev.tca,
            "miss_distance": ev.miss_distance,
            "pc": ev.pc,
            "compliance_status": ev.compliance_status
        }
        for ev in events
    ]

@router.get("/{event_id}")
async def get_conjunction_details(event_id: int, db: AsyncSession = Depends(get_db)):
    """
    Retrieves complete details of a specific conjunction event.
    Returns relative positions (Radial, In-track, Cross-track) and 
    uncertainty covariance matrices.
    """
    # Fetch event by ID
    query = select(ConjunctionEvent).filter_by(id=event_id)
    result = await db.execute(query)
    ev = result.scalar_one_or_none()
    
    if not ev:
        raise HTTPException(status_code=404, detail=f"Conjunction event with ID {event_id} not found.")

    # Fetch satellite objects
    p_result = await db.execute(select(Satellite).filter_by(norad_id=ev.primary_norad))
    primary = p_result.scalar_one_or_none()
    s_result = await db.execute(select(Satellite).filter_by(norad_id=ev.secondary_norad))
    secondary = s_result.scalar_one_or_none()

    # Parse covariance matrix JSON
    covariance_matrix = None
    if ev.covariance_matrix:
        if isinstance(ev.covariance_matrix, str):
            try:
                covariance_matrix = json.loads(ev.covariance_matrix)
            except json.JSONDecodeError:
                covariance_matrix = ev.covariance_matrix
        else:
            covariance_matrix = ev.covariance_matrix

    return {
        "id": ev.id,
        "primary": {
            "norad_id": ev.primary_norad,
            "name": primary.name if primary else "Unknown",
            "operator": primary.operator if primary else "Unknown"
        },
        "secondary": {
            "norad_id": ev.secondary_norad,
            "name": secondary.name if secondary else "Unknown",
            "operator": secondary.operator if secondary else "Unknown"
        },
        "tca": ev.tca,
        "miss_distance": ev.miss_distance,
        "relative_vectors": {
            "radial": ev.radial,
            "in_track": ev.in_track,
            "cross_track": ev.cross_track
        },
        "pc": ev.pc,
        "covariance_matrix": covariance_matrix,
        "compliance_status": ev.compliance_status
    }
