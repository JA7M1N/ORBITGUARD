import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import satellites, conjunctions, reentry, solar, ws_swarm, compliance, copilot, lunar

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    On startup, verify if the database contains any satellites.
    If empty or uninitialized, run the database seeders to populate initial demo data.
    """
    from backend.db.models import Satellite
    from sqlalchemy import select
    from backend.seed_db import seed as seed_db
    from backend.seed_reentry import seed as seed_reentry
    from backend.db.connection import AsyncSessionLocal
    
    run_seeding = False
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Satellite).limit(1))
            sat = result.scalars().first()
            if not sat:
                run_seeding = True
            else:
                print("OrbitGuard: DB data detected. Skipping automatic seed.")
        except Exception as e:
            print(f"OrbitGuard: Tables not initialized yet ({e}). Triggering schema generation and seeding...")
            run_seeding = True

    if run_seeding:
        try:
            print("==================================================")
            print("OrbitGuard: DB is empty/new. Running automatic seed...")
            print("==================================================")
            await seed_db()
            await seed_reentry()
            print("==================================================")
            print("OrbitGuard: Automatic database seeding complete!")
            print("==================================================")
        except Exception as se:
            print(f"OrbitGuard: Failed to execute automatic database seeding: {se}")
    yield

# 1. Instantiate the FastAPI application
app = FastAPI(
    title="OrbitGuard Space Safety API",
    description="REST API serving Space Situational Awareness, conjunction hazards, reentry alerts, and solar weather data.",
    version="1.0.0",
    lifespan=lifespan
)

# 2. Configure CORS middleware with strict domain restrictions for production
origins_env = os.getenv("ALLOWED_ORIGINS", "")
if origins_env:
    origins = [orig.strip() for orig in origins_env.split(",") if orig.strip()]
else:
    # Safe default developer and production Docker origins
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost",
        "http://127.0.0.1"
    ]

# If in sandbox/development debug mode, allow "*" wildcard
if os.getenv("ENV", "development").lower() == "development":
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Mount routers
app.include_router(satellites.router)
app.include_router(conjunctions.router)
app.include_router(reentry.router)
app.include_router(solar.router)
app.include_router(ws_swarm.router)
app.include_router(compliance.router)
app.include_router(copilot.router)
app.include_router(lunar.router)

# 4. Mount static model assets so Cesium can resolve relative paths
from fastapi.staticfiles import StaticFiles
models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "orbitguard-frontend", "public", "models")
if os.path.exists(models_dir):
    app.mount("/models", StaticFiles(directory=models_dir), name="models")
else:
    # Fallback to local directory relative to current working directory
    app.mount("/models", StaticFiles(directory="orbitguard-frontend/public/models"), name="models")


@app.get("/")
async def root():
    """
    Root endpoint verifying server status.
    """
    return {
        "status": "online",
        "service": "OrbitGuard Space Safety REST API",
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    """
    Standard health check endpoint.
    """
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    # Launch uvicorn programmatically when executed directly
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
