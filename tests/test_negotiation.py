import os
import json
from datetime import datetime, timezone, timedelta
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

# Set database URL to test SQLite before importing app
TEST_DB_FILE = "test_negotiation.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

from backend.main import app
from backend.db.models import Base, Satellite, ConjunctionEvent, ManeuverNegotiation

client = TestClient(app)

@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_test_database():
    """
    Setup temporary test SQLite database with seed data for negotiation testing.
    """
    test_db_url = f"sqlite+aiosqlite:///{TEST_DB_FILE}"
    engine = create_async_engine(test_db_url, echo=False)
    
    # 1. Create tables
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
    
    # 2. Insert mock seed data
    async with AsyncSessionLocal() as session:
        # Seed ISS satellite
        iss = Satellite(
            norad_id=25544,
            name="ISS (ZARYA)",
            operator="NASA/ROSCOSMOS",
            type="Payload",
            tle1="1 25544U 98067A   20351.52044444  .00001000  00000-0  26000-4 0  9998",
            tle2="2 25544  51.6467  44.5727 0002164  73.9623  34.8726 15.49280000260408",
            updated_at=datetime.utcnow()
        )
        
        # Seed secondary satellite
        sec = Satellite(
            norad_id=40001,
            name="DEBRIS MOCK",
            operator="DEBRIS",
            type="Debris",
            tle1="1 40001U 20001A   20351.52044444  .00001000  00000-0  26000-4 0  9998",
            tle2="2 40001  51.6467  44.5727 0002164  73.9623  34.8726 15.49280000260408",
            updated_at=datetime.utcnow()
        )
        
        # Conjunction Event
        event = ConjunctionEvent(
            id=1,
            primary_norad=25544,
            secondary_norad=40001,
            tca=datetime.utcnow() + timedelta(days=1),
            miss_distance=0.35,
            radial=0.1,
            in_track=0.2,
            cross_track=0.3,
            pc=2.3e-4,
            covariance_matrix={
                "p_cov": [[0.1, 0.0, 0.0], [0.0, 0.1, 0.0], [0.0, 0.0, 0.1]],
                "s_cov": [[0.15, 0.0, 0.0], [0.0, 0.15, 0.0], [0.0, 0.0, 0.15]]
            },
            compliance_status="Compliance Required"
        )
        
        session.add_all([iss, sec, event])
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


def test_get_negotiation_lazy_creation():
    """
    Verifies that requesting negotiation details automatically inserts a default session 
    into the database if none exists.
    """
    response = client.get("/api/negotiations/1")
    assert response.status_code == 200
    data = response.json()
    assert data["conjunction_id"] == 1
    assert data["status"] == "Proposed"
    assert data["primary_status"] == "Pending"
    assert data["secondary_status"] == "Pending"


def test_propose_maneuver_recalculated_math():
    """
    Verifies that proposing a burn calculates post-burn orbital elements, returning the 
    recalculated Pc and miss distance using Clohessy-Wiltshire transition math.
    """
    proposal = {
        "operator_role": "primary",
        "dv_radial": 1.5,
        "dv_in_track": 2.0,
        "dv_cross_track": -0.5,
        "lead_time_seconds": 3600.0
    }
    
    response = client.post("/api/negotiations/1/propose", json=proposal)
    assert response.status_code == 200
    data = response.json()
    
    # Verify post-maneuver verification fields exist
    assert "recalculated_miss_distance_km" in data
    assert "recalculated_pc" in data
    assert data["negotiation"]["primary_status"] == "Approved"
    assert data["negotiation"]["secondary_status"] == "Pending"
    assert data["negotiation"]["status"] == "Under Review"
    
    # Miss distance should have changed from 0.35 km due to burn
    assert data["recalculated_miss_distance_km"] != 0.35
    # The collision probability should decrease dramatically
    assert data["recalculated_pc"] < 2.3e-4


def test_resolve_agreement_workflow():
    """
    Verifies that counterpart approval updates status to Accepted and marks 
    the parent conjunction event compliance status as Resolved.
    """
    # 1. Propose burn from counterpart (secondary) to complete the dual approval condition
    proposal = {
        "operator_role": "secondary",
        "dv_radial": -1.0,
        "dv_in_track": 1.5,
        "dv_cross_track": 0.0,
        "lead_time_seconds": 3600.0
    }
    client.post("/api/negotiations/1/propose", json=proposal)
    
    # 2. Check resolve status beforehand
    conj_res = client.get("/api/conjunctions/1")
    assert conj_res.json()["compliance_status"] == "Compliance Required"
    
    # 3. Primary operator approves counterpart proposal
    resolve_payload = {
        "operator_role": "primary",
        "action": "approve"
    }
    response = client.post("/api/negotiations/1/resolve", json=resolve_payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "Accepted"
    assert data["primary_status"] == "Approved"
    assert data["secondary_status"] == "Approved"
    
    # 4. Conjunction compliance status should now be updated to Resolved
    conj_res = client.get("/api/conjunctions/1")
    assert conj_res.json()["compliance_status"] == "Resolved"
