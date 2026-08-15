# OrbitGuard: Backend & Systems Architect Concepts

This document outlines the software architecture, database management, real-time protocols, background processing, and integration pipelines maintained by the **Backend & Systems Architect**.

---

## ⚡ 1. FastAPI Framework & API Routing

OrbitGuard's backend is powered by **FastAPI**, a modern, high-performance web framework for Python.

### Architectural Principles
*   **Asynchronous Endpoints (`async`/`await`):** Leverages Python's `asyncio` to handle concurrent tasks without blocking the main event loop, crucial for real-time WebSocket traffic.
*   **Dependency Injection:** Uses FastAPI's `Depends` to inject database sessions (`get_db`) and service engines (e.g., SGP4 routers, compliance checkers) cleanly into routers.
*   **Pydantic Schema Validation:** Enforces strict type checking and serialization/deserialization for API request bodies (e.g., maneuver proposals, ground tracking coordinates).

---

## 🗄️ 2. Database ORM & PostgreSQL Spatial Architecture

The database layer handles both metadata storage and spatial vector listings.

### Database Technologies
*   **SQLAlchemy ORM:** Maps database rows to Python objects, handling session states and relationship management (e.g., Satellites has many State Vectors).
*   **SQLite (Local Environment):** Used for lightweight local development and testing (`orbitguard.db`).
*   **PostgreSQL & PostGIS (Production Environment):** Scaled via Docker. PostGIS is utilized to store satellite position coordinates as 3D spatial points, allowing native spatial queries.
*   **Database Schema Relations:**
    *   `satellites` 1-to-many `state_vectors` (propagated trajectories)
    *   `conjunction_events` 1-to-1 `maneuver_negotiations` (collaboration state tracking)

---

## 📡 3. WebSockets for Real-Time Conjunction Streams

Standard HTTP polling is inefficient for satellite collision monitoring. OrbitGuard uses full-duplex WebSockets.

### WebSocket Engine Details
*   **Connection Lifecycle:** Handles connection upgrades, active connection listings, and clean client disconnections.
*   **Message Broadcaster:** Periodically broadcasts active conjunction threats and simulated space weather telemetry updates from the background event loop to all connected React clients.
*   **Json Encapsulation:** Marshalls database entities and coordinate floats into structured JSON strings before dispatching.

---

## ⏱️ 4. Background Workers & Task Queuing

Physics propagators and Monte Carlo runs are computationally expensive and cannot block HTTP request threads.
*   **Asynchronous Background Tasks:** Runs high-latency operations (like spawning 100 Runge-Kutta deorbit integrations or querying spatial KD-Trees) asynchronously using FastAPI's background tasks or standard Python thread pools.
*   **Process Concurrency:** Leverages parallel processing for Monte Carlo simulations, dispersing drag coefficient parameters ($C_d$) and density indices ($\rho$) across multiple CPU cores.

---

## 📄 5. Dynamic Report Generation (ReportLab PDF Engine)

Operators require certified documentation for regulatory compliance audits and collision maneuvers.
*   **ReportLab PDF Canvas:** Builds layouts dynamically using Flowables (paragraphs, tables, charts, spacers) to generate PDF documents programmatically.
*   **Automated Layout Checks:** Spans tables, page breaks, and margin adjustments dynamically based on satellite state telemetry.

---

## 🤖 6. LLM Integration Pipeline (Llama-3.2 Briefings)

To provide human-readable summaries of complex space situations:
*   **AI Prompt Compiler:** Aggregates satellite identifiers, closest approach distances, collision probabilities, and solar weather conditions into a contextual text prompt.
*   **Llama-3.2 Model Calls:** Connects to local/hosted Llama-3.2 endpoints to generate natural language briefings (e.g., "Satellite NORAD 25544 is facing a critical collision hazard with space debris...").

---

## 🐳 7. Deployment Configuration (Docker Compose)

The systems architect maintains OrbitGuard's infrastructure stack using Docker Compose:
*   **App Container:** Packages the FastAPI backend, installing requirements (SGP4, Skyfield, SQLAlchemy).
*   **DB Container:** Spawns a PostgreSQL image configured with PostGIS extensions enabled.
*   **Volume & Environment Setup:** Mounts database files and imports active environmental variables (`.env`).
