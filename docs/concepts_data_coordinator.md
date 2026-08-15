# OrbitGuard: Data Coordination & Data Ingestion Concepts Reference

This document serves as the technical handbook for the **Data Coordinator** role. It maps out how raw data, space weather bulletins, TLE files, telemetry feeds, and databases are ingested, structured, processed, and cached within OrbitGuard.

---

## 🛰️ 1. Two-Line Element (TLE) Ingestion & Parsing

OrbitGuard ingests raw TLE catalogs to track objects in Earth orbit.

### What is a TLE?
A Two-Line Element set is a standardized data format consisting of two 69-character lines of ASCII text. It describes the orbital elements of an Earth-orbiting object for a given epoch.
*   **Line 1:** NORAD ID, classification, international designator, epoch time (year & fractional day), decay rate terms, and the $B^*$ drag term.
*   **Line 2:** Inclination, RAAN, Eccentricity (with implicit leading decimal), Argument of Perigee, Mean Anomaly, Mean Motion (orbits per day), and revolution number.

### Parsing Engine
The backend reads raw text strings (either from local caches or external API fetches) and parses them using the `sgp4.api.Satrec` parser to create orbital structures in memory.

---

## 🌲 2. Spatial KD-Tree Conjunction Screening

In a catalog of thousands of satellites, comparing every satellite to every other satellite is an $O(N^2)$ computation, which is too slow for a real-time platform.

### Concepts & Implementation
*   **KD-Tree (K-Dimensional Tree):** A space-partitioning data structure for organizing points in a $k$-dimensional space. OrbitGuard uses Python's `scipy.spatial.KDTree`.
*   **3D Cartesian State Projection:** At a given epoch slice $t$, SGP4 propagates the position of all satellites in the database to 3D Cartesian coordinates $(x, y, z)$.
*   **Query Filtering:** A 3D spatial tree is built from these points. The tree is queried with a collision search radius (e.g., 50 km). This reduces screening time to $O(N \log N)$, flagging candidate pairs for close-approach calculation.

---

## 💾 3. Data Caching Strategies

To ensure offline accessibility, low-latency, and API rate-limiting compliance, OrbitGuard implements cache endpoints:

### TLE Cache (`active_tle_cache.txt`)
*   Stores catalog listings of active satellites.
*   Ensures that SGP4 orbital propagation runs instantly without needing a network connection to space-track servers during testing.

### Solar Weather Cache (`solar_weather_cache.json`)
*   Caches solar activity parameters ($F_{10.7}$ solar flux, $A_p$ geomagnetic index values).
*   Prevents redundant hits to NOAA's space-weather servers.

---

## 🗄️ 4. Relational & Spatial Database Schemas

OrbitGuard uses a relational database powered by SQLite for local development and PostgreSQL + PostGIS for production scales.

### DB Schema Architecture
*   **`satellites` Table:** Primary metadata repository (NORAD ID, satellite name, raw TLE strings).
*   **`state_vectors` Table:** Stores time-series data of propagated positions and velocities:
    *   NORAD ID (Foreign Key)
    *   Epoch timestamp
    *   Position vector ($x, y, z$) and Velocity vector ($v_x, v_y, v_z$)
*   **`conjunction_events` Table:** Tracks close-approach pairs:
    *   Primary NORAD ID / Secondary NORAD ID
    *   Time of Closest Approach (TCA)
    *   Miss distance (m)
    *   Collision probability ($P_c$)
*   **`maneuver_negotiations` Table:** Stores multilateral coordination maneuvers, proposed Radial-In-Track-Cross-Track (RIC) delta-V changes, and approvals.

---

## 📡 5. Telemetry & Live Data Feeds

OrbitGuard integrates and parses three external data schemas:
1.  **NOAA Space Weather Data:** Parses $F_{10.7}$ solar flux levels and $A_p$ planetary indexes.
2.  **Aditya-L1 Telemetry Mock Feed:** Mocks live telemetry packages:
    *   SoLEXS sensor (Soft X-ray solar flare levels)
    *   HEL1OS sensor (Hard X-ray solar particle counts)
3.  **Bayesian Tracking Observations:** Parses azimuth/elevation tracking vectors submitted by ground tracking stations to refine positional covariances.

---

## 📄 6. Standard Export Formats

The Data Coordinator ensures that outputs comply with international astronomical data standards:
*   **CCSDS OPM (Orbit Parameter Message):** An ASCII standard formatting satellite state vectors, Keplerian parameters, and maneuver burns.
*   **GeoJSON:** A standard format for encoding geographical structures. The results of the Monte Carlo decay simulation are exported as GeoJSON polygon boundaries to be rendered on GIS maps.
*   **JSON API Endpoints:** Structured responses mapping conjunction tables, lunar paths, and solar flare timelines.
