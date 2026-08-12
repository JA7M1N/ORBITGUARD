import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_get_lunar_hazards():
    """
    Verify that GET /api/lunar/hazards returns lists of major polar craters
    and preset polar missions correctly.
    """
    res = client.get("/api/lunar/hazards")
    assert res.status_code == 200
    
    data = res.json()
    assert "craters" in data
    assert "missions" in data
    
    # Assert major craters exist in catalog
    crater_names = [c["name"] for c in data["craters"]]
    assert "Shackleton" in crater_names
    assert "Shoemaker" in crater_names
    assert "Faustini" in crater_names
    
    # Assert mission keys are populated
    assert "site_alpha_to_shackleton" in data["missions"]
    assert "site_beta_to_faustini" in data["missions"]


def test_post_lunar_pathfind_success():
    """
    Verify that POST /api/lunar/pathfind calculates an A* traversal path
    bypassing hazard circles, returning waypoint routes and telemetry metrics.
    """
    payload = {
        "start_lat": -87.0,
        "start_lon": 10.0,
        "end_lat": -89.8,
        "end_lon": 5.0
    }
    
    res = client.post("/api/lunar/pathfind", json=payload)
    assert res.status_code == 200
    
    data = res.json()
    assert data["status"] == "success"
    assert "waypoints" in data
    assert "metrics" in data
    
    waypoints = data["waypoints"]
    metrics = data["metrics"]
    
    # Assert path waypoint structure
    assert len(waypoints) >= 2
    assert "lat" in waypoints[0]
    assert "lon" in waypoints[0]
    assert "slope" in waypoints[0]
    
    # Assert first waypoint is close to start
    assert abs(waypoints[0]["lat"] - (-87.0)) < 0.5
    assert abs(waypoints[0]["lon"] - 10.0) < 5.0
    
    # Assert last waypoint is close to end
    assert abs(waypoints[-1]["lat"] - (-89.8)) < 0.5
    
    # Assert metrics contain positive distance and valid percentage ranges
    assert metrics["total_distance_km"] > 0
    assert 0 <= metrics["max_slope_gradient_pct"] <= 90.0
    assert 0 <= metrics["safety_margin_pct"] <= 100.0
