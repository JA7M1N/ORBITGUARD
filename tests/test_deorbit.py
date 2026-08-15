import os
import json
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

TEST_DB_FILE = "test_deorbit.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

from backend.main import app
from backend.db.models import Base, Satellite

client = TestClient(app)

@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_test_database():
    """
    Setup temporary test SQLite database with seed data for deorbit testing.
    """
    test_db_url = f"sqlite+aiosqlite:///{TEST_DB_FILE}"
    engine = create_async_engine(test_db_url, echo=False)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    # Override get_db dependency in app
    async def override_get_db():
        async with AsyncSessionLocal() as session:
            yield session
            
    from backend.db.connection import get_db
    app.dependency_overrides[get_db] = override_get_db
    
    from datetime import datetime
    
    # Insert mock seed data
    async with AsyncSessionLocal() as session:
        sat = Satellite(
            norad_id=25544,
            name="ISS (ZARYA)",
            operator="NASA/ROSCOSMOS",
            type="Payload",
            tle1="1 25544U 98067A   20351.52044444  .00001000  00000-0  26000-4 0  9998",
            tle2="2 25544  51.6467  44.5727 0002164  73.9623  34.8726 15.49280000260408",
            updated_at=datetime.utcnow()
        )
        session.add(sat)
        await session.commit()
        
    yield
    
    # Clean up connection
    from backend.db.connection import get_db
    app.dependency_overrides.pop(get_db, None)
    await engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


def test_custom_altitude_deorbit_passed():
    """
    Verifies that a low altitude satellite (e.g. 300km) decays and deorbits 
    within the 5-year compliance limit.
    """
    payload = {
        "altitude_km": 300.0,
        "ballistic_coefficient": 0.015,
        "solar_scenario": "nominal"
    }
    
    response = client.post("/api/deorbit/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["compliance_status"] == "PASSED"
    assert data["deorbit_occurred"] is True
    assert data["decay_time_years"] <= 5.0
    assert len(data["trajectory"]) > 0
    assert "satisfies the regulatory 5-year post-mission deorbit rule" in data["audit_report_text"]


def test_custom_altitude_deorbit_failed():
    """
    Verifies that a high altitude satellite (e.g. 800km) does not decay 
    within the 5-year compliance limit.
    """
    payload = {
        "altitude_km": 800.0,
        "ballistic_coefficient": 0.012,
        "solar_scenario": "nominal"
    }
    
    response = client.post("/api/deorbit/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["compliance_status"] == "FAILED"
    assert "violates the regulatory 5-year deorbit mandate" in data["audit_report_text"]


def test_norad_id_tle_deorbit_audit():
    """
    Verifies that deorbit audit works by resolving catalog satellite NORAD IDs.
    """
    payload = {
        "norad_id": 25544,
        "ballistic_coefficient": 0.015,
        "solar_scenario": "stormy"
    }
    
    response = client.post("/api/deorbit/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["satellite_name"] == "ISS (ZARYA)"
    assert data["initial_altitude_km"] > 350.0
    assert "trajectory" in data
