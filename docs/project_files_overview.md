# OrbitGuard Project Files Overview

This document provides a detailed overview of the project structure, listing every core script and file along with its purpose and functionality in the **OrbitGuard Space Safety Platform**.

---

## 📂 Root Level Configuration

* **[`docker-compose.yml`](file:///c:/Users/jaymi/Documents/OrbitGuard/docker-compose.yml)**  
  Orchestrates the multi-stage Docker deployment, binding the PostGIS database, FastAPI backend, and React frontend. Configured with a `pg_isready` database healthcheck to ensure database initialization before starting the backend.
* **[`db/migrations/init_db.sql`](file:///c:/Users/jaymi/Documents/OrbitGuard/db/migrations/init_db.sql)**  
  Initial SQL migration script creating database schemas and spatial indexes for satellites, conjunctions, filings, and negotiations.
* **[`seed_db.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/seed_db.py)**  
  Database seeder script that populates the PostgreSQL database with 500 satellites, precomputes orbital trajectories, and inserts critical conjunction hazards.
* **[`verify_production.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/verify_production.py)**  
  A verification test suite executing production latency checks on REST endpoints, SGP4 limits, Ollama responses, and ReportLab PDF document compilation.

---

## 📂 Backend Core (`backend/`)

* **[`backend/main.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/main.py)**  
  FastAPI application entrypoint. Configures CORS, sets up routing tables, handles database lifecycles, and mounts the WebSocket handler.
* **[`backend/db/connection.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/db/connection.py)**  
  Configures the SQLAlchemy asynchronous database engine and session pool using `asyncpg`.
* **[`backend/db/models.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/db/models.py)**  
  Defines the database schema models (Satellite, StateVector, ConjunctionEvent, ComplianceFiling, ObservationRefinement, NegotiationThread).
* **[`backend/services/compliance_generator.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/services/compliance_generator.py)**  
  Generates collision avoidance briefs using Ollama Llama 3.2 and compiles print-ready compliance PDFs with `KeepTogether` page constraints and SHA-256 signatures.
* **[`backend/services/swarm_orchestrator.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/services/swarm_orchestrator.py)**  
  WebSocket server manager that broadcasts real-time simulation coordinates, processes observation updates, and broadcasts solar storm triggers.

### 🛣️ API Routers (`backend/routers/`)
* **[`routers/satellites.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/satellites.py)**  
  Endpoints to search the satellite catalog, export TLEs, and generate 7-tuple spline trajectory packets for Cesium CZML loading.
* **[`routers/conjunctions.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/conjunctions.py)**  
  Handles spatial KD-Tree conjunction screening, hazard thresholds, and close-approach telemetry queries.
* **[`routers/compliance.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/compliance.py)**  
  Manages compliance maneuver filing submissions, SGP4 state vector projections, and filing PDF downloads.
* **[`routers/refinement.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/refinement.py)**  
  Processes tracking observations and updates orbital covariance uncertainty via a Bayesian Information Filter.
* **[`routers/negotiations.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/negotiations.py)**  
  Maintains Operator-to-Operator negotiation chat threads and burn proposal agreements.
* **[`routers/solar.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/solar.py)**  
  Provides live NOAA space weather indices and CME flare forecast simulations.
* **[`routers/reentry.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/reentry.py)**  
  Propagates numerical decay paths and runs 100-run Monte Carlo simulation blocks to map reentry landing risk polygons.
* **[`routers/lunar.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/lunar.py)**  
  Integrates cislunar paths under three-body gravity and runs A* pathfinding over lunar South Pole hazard grids.
* **[`routers/copilot.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/routers/copilot.py)**  
  AI Copilot chat gateway. Integrates a 300s query cache and 5-second Llama 3.2 timeouts with structured Markdown reports as fail-safes.

---

## 📂 Orbital Mechanics Engine (`orbital_mechanics/`)

* **[`orbital_mechanics/propagator.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbital_mechanics/propagator.py)**  
  High-speed SGP4 propagation wrapper resolving TLE positions, velocities, and catalog sweeps.
* **[`orbital_mechanics/conjunction_math.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbital_mechanics/conjunction_math.py)**  
  Projects covariances onto the Encounter Plane (B-plane) and calculates collision probability ($P_c$) via Chan's analytical Rician series.
* **[`orbital_mechanics/decay_engine.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbital_mechanics/decay_engine.py)**  
  Explicit Runge-Kutta 4th Order numerical integrator modeling J2 gravity perturbations and NRLMSISE-00 relative atmospheric drag.
* **[`orbital_mechanics/lunar_engine.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbital_mechanics/lunar_engine.py)**  
  CR3BP equations of motion, polar stereographic coordinates transformations, and A* pathfinder slope/obstacle cost calculations.

---

## 📂 React Frontend (`orbitguard-frontend/src/`)

* **[`src/App.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/App.tsx)**  
  Vite entry router. Orchestrates page loading, the 60-second guides auto-tour, and mounts the sliding FAQ Cheatsheet.
* **[`src/index.css`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/index.css)**  
  Implements the global CSS design tokens, typography, and slate/purple dark glassmorphic components.

### 📊 Frontend Pages (`src/pages/`)
* **[`pages/DashboardPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/DashboardPage.tsx)**  
  Home view displaying close approach hazard counters, live alerts, and NOAA solar flux graphs.
* **[`pages/CatalogPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/CatalogPage.tsx)**  
  Allows operators to browse catalog satellites, upload custom TLEs, and export CCSDS OPM files.
* **[`pages/ConjunctionPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/ConjunctionPage.tsx)**  
  Lists close approach events, highlighting critical conjunctions and offering compliance filing shortcuts.
* **[`pages/ReentryPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/ReentryPage.tsx)**  
  Displays orbital decay timelines, maps Monte Carlo touchdown dispersion points on a Leaflet overlay, and initiates reentry simulations.
* **[`pages/SolarPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/SolarPage.tsx)**  
  Tracks solar CME flares and provides a simulator to trigger geomagnetic storm visual effects on the globe.
* **[`pages/LunarPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/LunarPage.tsx)**  
  Renders cislunar spacecraft orbits and runs lunar South Pole corridor pathfinding.
* **[`pages/CopilotPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/CopilotPage.tsx)**  
  Chat terminal for the AI Copilot. Utilizes typing animation loops and handles page switching cleanly.
* **[`pages/RefinementPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/RefinementPage.tsx)**  
  Bayesian Orbit Determination dashboard. Submits ground observations and charts covariance matrix trace shrinkage.
* **[`pages/NegotiationPage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/NegotiationPage.tsx)**  
  Operator maneuver negotiation hub with thread messaging and burn approvals.
* **[`pages/CompliancePage.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/pages/CompliancePage.tsx)**  
  Lists all filed collision avoidance documents (INSPACE-CAM-2026) and handles PDF downloads.

### 🧩 Shared Components (`src/components/`)
* **[`components/OrbitGlobe.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/OrbitGlobe.tsx)**  
  Vibrant 3D Resium/CesiumJS earth visualization rendering live TLE orbits, collision animations, and ground sensor lines.
* **[`components/Sidebar.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/Sidebar.tsx)**  
  Sidebar navigation menu with collapse/expand support.
* **[`components/MetricCard.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/MetricCard.tsx)**  
  Stat metrics display card widget.
* **[`components/FaqDrawer.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/FaqDrawer.tsx)**  
  Sliding cheat sheet pane that answers judges' questions.
