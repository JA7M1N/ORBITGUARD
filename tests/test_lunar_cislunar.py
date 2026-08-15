import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_tli_cislunar_propagation():
    """
    Asserts that Earth Trans-Lunar Injection (TLI) insertion coordinates 
    propagate correctly and yield Earth/Moon distance thresholds and 
    Jacobi energy states.
    """
    payload = {
        "x": 6700.0,
        "y": 0.0,
        "z": 0.0,
        "vx": 0.0,
        "vy": 10.92,
        "vz": 0.0,
        "duration_days": 4.5
    }
    
    response = client.post("/api/lunar/propagate", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "success"
    assert len(data["trajectory"]) > 0
    assert len(data["moon_trajectory"]) > 0
    
    metrics = data["metrics"]
    assert "minimum_moon_distance_km" in metrics
    assert "minimum_earth_distance_km" in metrics
    assert "energy_state_jacobi" in metrics
    assert metrics["safety_status"] in ["NOMINAL", "WARNING", "CRITICAL HAZARD"]


def test_nrho_gateway_propagation():
    """
    Asserts that propagation from the Lunar Near-Rectilinear Halo Orbit (NRHO) 
    gateway orbit works and generates proximity safety warnings.
    """
    payload = {
        "x": 384400.0,
        "y": 0.0,
        "z": 4500.0,
        "vx": -0.95,
        "vy": 0.0,
        "vz": 0.0,
        "duration_days": 8.0
    }
    
    response = client.post("/api/lunar/propagate", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "success"
    assert len(data["trajectory"]) > 0
    
    metrics = data["metrics"]
    # Spacecraft starts close to the Moon, so min distance to Moon should be small
    assert metrics["minimum_moon_distance_km"] < 10000.0
    # There should be a safety status alert or warning message populated
    assert metrics["warning_message"] is not None
