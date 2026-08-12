from typing import List, Dict
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
import numpy as np

from orbital_mechanics.solar_weather import (
    fetch_live_noaa_data,
    fetch_aditya_l1_data,
    trigger_aditya_flare,
    clear_aditya_flare
)

router = APIRouter(prefix="/api/solar", tags=["solar"])

@router.get("")
async def get_solar_weather():
    """
    Retrieves the current space weather parameters (observed F10.7 and Ap index),
    threat levels, and a 7-day historical trend.
    """
    # Fetch live or cached solar parameters (incorporating Aditya-L1 CME storm scaling)
    aditya_data = fetch_aditya_l1_data(cache_path="solar_weather_cache.json")
    f10_7 = aditya_data["f10_7"]
    ap = aditya_data["ap"]
    
    # 1. Determine alert level based on index thresholds
    # F10.7: < 90 = Low, 90-150 = Moderate, 150-220 = High, > 220 = Severe
    # Ap: < 15 = Quiet, 15-30 = Active, 30-50 = Minor Storm, > 50 = Major Storm
    if f10_7 > 220.0 or ap > 50.0:
        alert_level = "Severe"
        description = "Extreme solar activity or major geomagnetic storm. Upper atmosphere heating is significantly increasing satellite drag."
    elif f10_7 > 150.0 or ap > 30.0:
        alert_level = "High"
        description = "Elevated solar activity. Orbital decay rates are accelerated."
    elif f10_7 > 90.0 or ap > 15.0:
        alert_level = "Moderate"
        description = "Moderate solar activity. Normal orbital decay progression."
    else:
        alert_level = "Low"
        description = "Quiet space weather. Baseline drag conditions apply."

    # 2. Synthesize a realistic 7-day historical trend for visualization
    # We add minor random fluctuations (normal distribution) around the current observed indices
    np.random.seed(int(aditya_data["timestamp"]) % 10000) # Seeding for deterministic trend per timestamp
    
    trend = []
    now = datetime.now()
    for i in reversed(range(7)):
        date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        trend.append({
            "date": date_str,
            "f10_7": round(f10_7 + float(np.random.normal(0, 4.0)), 2),
            "ap": max(0.0, round(ap + float(np.random.normal(0, 2.0)), 2))
        })
        
    return {
        "f10_7": f10_7,
        "ap": ap,
        "drag_scaler": float(f10_7 / 70.0),
        "historical": trend,
        "current": {
            "f10_7": f10_7,
            "ap": ap,
            "updated_at": datetime.fromtimestamp(aditya_data["timestamp"])
        },
        "alert_metrics": {
            "level": alert_level,
            "description": description,
            "quiet_baseline_sfu": 70.0
        },
        "trend_history": trend
    }

@router.get("/aditya-l1")
async def get_aditya_l1():
    """
    Returns the real-time simulated SoLEXS & HEL1OS X-ray flux, CME propagation progress,
    and geomagnetic storm status.
    """
    try:
        return fetch_aditya_l1_data(cache_path="solar_weather_cache.json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Aditya-L1 data: {e}")

@router.post("/trigger-flare/{flare_class}")
async def trigger_flare(flare_class: str):
    """
    Manually triggers a simulated solar flare event of a specified class ('C', 'M', or 'X').
    """
    flare_class = flare_class.upper()
    if flare_class not in ["C", "M", "X"]:
        raise HTTPException(status_code=400, detail="Invalid flare class. Must be C, M, or X.")
    try:
        event = trigger_aditya_flare(flare_class)
        return {"status": "success", "triggered_event": event}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger solar flare: {e}")

@router.post("/clear-flare")
async def clear_flare():
    """
    Clears any active simulated flare events.
    """
    try:
        clear_aditya_flare()
        return {"status": "success", "detail": "Active solar flares cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear solar flare: {e}")
