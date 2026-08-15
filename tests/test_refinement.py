import os
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

TEST_DB_FILE = "test_refinement.db"
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
    Setup temporary test SQLite database with seed data for refinement testing.
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
    
    # Insert mock seed data
    from datetime import datetime
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


def test_istrac_covariance_refinement_passed():
    """
    Verifies that incorporating range observations from ISTRAC ground station 
    produces a valid orbit determination fit, reducing ECI covariance trace 
    with low average residual limits.
    """
    payload = {
        "norad_id": 25544,
        "station_id": "istrac_bengaluru",
        "measurement_noise_m": 45.0,
        "num_observations": 25
    }
    
    response = client.post("/api/refinement/fit", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "success"
    assert data["satellite_name"] == "ISS (ZARYA)"
    assert data["station_name"] == "ISRO ISTRAC Ground Station (Bengaluru, India)"
    assert data["refined_covariance_trace_km2"] < data["prior_covariance_trace_km2"]
    assert data["covariance_reduction_pct"] > 50.0
    assert len(data["residuals_chart"]) > 0
    assert "Orbit Determination Converged" in data["refinement_report_text"]
