import os
import time
import json
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

# Import astrodynamics math functions
from orbital_mechanics.screening import screen_conjunctions
from orbital_mechanics.solar_weather import get_drag_coefficient_scaler
from backend.services.compliance_generator import compile_pdf_document
from backend.routers.copilot import generate_offline_fallback

def test_kdtree_screening_correctness_and_speed():
    """
    Verify KD-Tree conjunction screening correctly filters close approaches 
    within the specified distance threshold, and runs in sub-millisecond ranges.
    """
    # Create 10 satellites grouped at the same epoch, where exactly one pair is within 5.0 km
    epoch = datetime(2026, 8, 9, 12, 0, 0)
    
    state_vectors = []
    # 8 satellites spread out by 100km each
    for i in range(8):
        state_vectors.append({
            "norad_id": 100 + i,
            "name": f"Sat {i}",
            "epoch": epoch,
            "position_x": 7000.0 + i * 100.0,
            "position_y": 0.0,
            "position_z": 0.0,
            "velocity_x": 0.0,
            "velocity_y": 7.5,
            "velocity_z": 0.0
        })
        
    # 2 close approach satellites: 1000 and 1001, separated by 3.5 km
    state_vectors.append({
        "norad_id": 1000,
        "name": "Target A",
        "epoch": epoch,
        "position_x": 6800.0,
        "position_y": 0.0,
        "position_z": 0.0,
        "velocity_x": 0.0,
        "velocity_y": 7.5,
        "velocity_z": 0.0
    })
    state_vectors.append({
        "norad_id": 1001,
        "name": "Target B",
        "epoch": epoch,
        "position_x": 6803.5, # 3.5 km separation in X
        "position_y": 0.0,
        "position_z": 0.0,
        "velocity_x": 0.0,
        "velocity_y": 7.5,
        "velocity_z": 0.0
    })

    # Measure speed using patch on propagator module to prevent catalog file read overhead
    with patch("orbital_mechanics.propagator.fetch_active_catalog", return_value=[]):
        start_time = time.perf_counter()
        conjunctions = screen_conjunctions(state_vectors, threshold_km=10.0)
        duration_ms = (time.perf_counter() - start_time) * 1000.0
    
    # Assert KD-Tree execution is fast
    assert duration_ms < 50.0  # target: <50ms (usually <1ms without disk IO)
    
    # Assert correctness
    assert len(conjunctions) == 1
    assert conjunctions[0]["primary_id"] == 1000
    assert conjunctions[0]["secondary_id"] == 1001
    assert pytest.approx(conjunctions[0]["miss_distance"], abs=1e-3) == 3.5

def test_solar_drag_scaler():
    """
    Verify get_drag_coefficient_scaler correctly scales based on NOAA indices.
    """
    # Quiet sun baseline (70 sfu) -> no scaling (1.0)
    assert get_drag_coefficient_scaler(70.0) == 1.0
    # High solar activity (250 sfu) -> scales up (> 1.0)
    assert get_drag_coefficient_scaler(250.0) > 1.0
    # Quiet solar activity (50 sfu) -> scales down (< 1.0)
    assert get_drag_coefficient_scaler(50.0) < 1.0

def test_pdf_compliance_compilation_robustness(tmp_path):
    """
    Verify compile_pdf_document compiles a valid PDF on disk with formal table parameters.
    """
    filing_data = {
        "id": 12345,
        "satellite": "ISS (ZARYA)",
        "primary_norad": 25544,
        "secondary_norad": 900,
        "operator": "NASA/ROSCOSMOS",
        "tca": datetime(2026, 8, 9, 12, 0, 0, tzinfo=timezone.utc),
        "status": "Filed",
        "submitted_at": datetime.now(timezone.utc),
        "briefing": "INSPACE-CAM-2026 Conjunction Risk Mitigation Briefing. Path nominal."
    }
    
    # Mock covariance matrix and state vector endpoints
    filing_data["primary_state"] = {"position": [4200.0, 3100.0, 5000.0], "velocity": [5.0, 4.0, 3.0]}
    filing_data["secondary_state"] = {"position": [4200.05, 3100.02, 5000.01], "velocity": [5.0, 4.0, 5.0]}
    filing_data["covariance"] = {"p_cov": [[1.0, 0.0], [0.0, 1.0]], "s_cov": [[1.0, 0.0], [0.0, 1.0]]}
    
    output_pdf = tmp_path / "INSPACE_CAM_test_compliance.pdf"
    
    with patch("backend.services.compliance_generator.os.path.join", return_value=str(output_pdf)):
        pdf_path = compile_pdf_document(filing_data)
        assert os.path.exists(pdf_path)
        assert os.path.getsize(pdf_path) > 0

def test_copilot_offline_fallback_generator():
    """
    Verify generate_offline_fallback formats raw DB contexts correctly 
    into markdown structures when the LLM service is offline.
    """
    context_details = [
        {
            "type": "satellite",
            "norad_id": 25544,
            "name": "ISS (ZARYA)",
            "operator": "NASA/ROSCOSMOS",
            "sat_type": "Payload",
            "tle1": "1 25544U 98067A...",
            "tle2": "2 25544  51.6467..."
        },
        {
            "type": "solar",
            "f10_7": 220.0,
            "ap": 32,
            "active_flare": "X",
            "cme_speed": 1200.0,
            "cme_progress": "85%",
            "impact_active": "Yes"
        }
    ]
    
    report = generate_offline_fallback(context_details, "Is there any storm alert for ISS?")
    assert "Offline Assistant Telemetry Report" in report
    assert "ISS (ZARYA)" in report
    assert "NASA/ROSCOSMOS" in report
    assert "Space Weather" in report
    assert "220.0 sfu" in report
    assert "CME Speed: 1200.0 km/s" in report
