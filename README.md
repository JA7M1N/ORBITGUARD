# OrbitGuard Space Safety Platform

OrbitGuard is an end-to-end Space Situational Awareness (SSA) and Space Safety platform designed to ingest TLE catalogs, screen for close approach conjunction hazards using spatial KD-Trees, compute high-fidelity collision probabilities, run parallelized Monte Carlo orbital decay simulations, and automate CAM (Collision Avoidance Maneuver) regulatory compliance filings.

---

## 🛰️ System Architecture

The repository is organized into three major components:
1. **`orbital_mechanics/`**: The core physics engine. Handles SGP4 orbital propagation, 2D B-plane encounter frame coordinate projections, Chan's analytical Rician series for Probability of Collision (\(P_c\)), J2 oblate gravity perturbations, and NRLMSISE-00 atmospheric drag modeling.
2. **`backend/`**: A FastAPI REST and WebSocket server. Serves satellite state vectors, conjunction hazardous events, NOAA solar weather indices, and dynamically compiles PDF briefs via ReportLab and Llama-3.2 briefing statements.
3. **`orbitguard-frontend/`**: A React + Vite dashboard styled with premium glassmorphism aesthetics. Visualizes orbits on a 3D CesiumJS globe, maps decay landing corridors on Leaflet 2D maps, and exposes flight control systems.

---

## 🧮 Physics & Mathematics Specifications

### 1. Conjunction screening & Foster-Elrod / Chan $P_c$
Close approaches are initially filtered using a 3D spatial **KD-Tree** on epoch slices of propagated orbits.
For screened candidate events, the relative state at the Time of Closest Approach (TCA) is projected onto the **2D B-plane (encounter frame)** perpendicular to the relative velocity vector $\mathbf{v}_{\text{rel}} = \mathbf{v}_p - \mathbf{v}_s$:
- $\hat{\mathbf{e}}_z = \frac{\mathbf{v}_{\text{rel}}}{\|\mathbf{v}_{\text{rel}}\|_2}$
- $\hat{\mathbf{e}}_x = \frac{\mathbf{ref} \times \hat{\mathbf{e}}_z}{\|\mathbf{ref} \times \hat{\mathbf{e}}_z\|_2}$ (where $\mathbf{ref}$ is a stable reference vector)
- $\hat{\mathbf{e}}_y = \hat{\mathbf{e}}_z \times \hat{\mathbf{e}}_x$

The 2D projection matrix $P = [\hat{\mathbf{e}}_x, \hat{\mathbf{e}}_y]^T$ projects the relative position $\mathbf{r}_{\text{rel}} = \mathbf{r}_p - \mathbf{r}_s$ and the combined ECI covariance matrix $C = C_p + C_s$:
$$\mathbf{r}_B = P \mathbf{r}_{\text{rel}}, \quad \Sigma_B = P C P^T$$

The covariance $\Sigma_B$ is diagonalized to compute principal uncertainty eigenvalues ($\sigma_x^2$, $\sigma_y^2$). Rotating $\mathbf{r}_B$ into the principal frame yields $(x_m, y_m)$. Chan's analytical Rician series calculates the collision probability $P_c$ for a Hard Body Radius $R_v$:
$$u = \left(\frac{x_m}{\sigma_x}\right)^2 + \left(\frac{y_m}{\sigma_y}\right)^2, \quad v = \sqrt{u}\sqrt{\sigma_x \sigma_y}, \quad \beta = \frac{R_v}{\sqrt{\sigma_x \sigma_y}}$$
$$P_c = e^{-\frac{u}{2}} \sum_{k=0}^{\infty} \frac{1}{k!} \left(\frac{u}{2}\right)^k P\left(k+1, \frac{\beta^2}{2}\right)$$

### 2. Orbit Decay & NRLMSISE-00 Atmospheric Drag
Reentry trajectories are numerically integrated (using a vectorized Runge-Kutta step) down to the $80\text{ km}$ breakup interface. The equations of motion account for Newtonian gravity, J2 oblate perturbations, and atmospheric drag:
$$\mathbf{a}_{\text{total}} = -\frac{\mu}{r^3} \mathbf{r} + \mathbf{a}_{J2} + \mathbf{a}_{\text{drag}}$$

The J2 acceleration is:
$$\mathbf{a}_{J2} = \frac{3 J_2 \mu R_E^2}{2 r^5} \begin{bmatrix} x \left(5 \frac{z^2}{r^2} - 1\right) \\ y \left(5 \frac{z^2}{r^2} - 1\right) \\ z \left(5 \frac{z^2}{r^2} - 3\right) \end{bmatrix}$$

The atmospheric drag acceleration $\mathbf{a}_{\text{drag}}$ accounts for a co-rotating atmosphere:
$$\mathbf{a}_{\text{drag}} = -\frac{1}{2} C_d \left(\frac{A}{m}\right) \rho v_{\text{rel}} \mathbf{v}_{\text{rel}}$$
$$\mathbf{v}_{\text{rel}} = \mathbf{v} - \boldsymbol{\omega}_E \times \mathbf{r}$$
Where:
- $\boldsymbol{\omega}_E = [0, 0, 7.292115 \times 10^{-5}]^T\text{ rad/s}$ is Earth's angular rotation vector.
- $\rho$ is the atmospheric mass density ($kg/m^3$) computed using the **NRLMSISE-00** model (scaled by F10.7 solar flux and Ap indices).

---

## 🗄️ Database Schema & ERD

The system maps relational and spatial tables using SQLAlchemy. Under PostgreSQL, spatial attributes map directly to PostGIS objects.

```mermaid
erDiagram
    SATELLITES ||--o{ STATE_VECTORS : "has"
    SATELLITES ||--o| REENTRY_ALERTS : "reenters"
    SATELLITES {
        int norad_id PK
        string name
        string operator
        string type
        string tle1
        string tle2
        timestamp updated_at
    }
    STATE_VECTORS {
        int id PK
        int norad_id FK
        timestamp epoch
        double position_x
        double position_y
        double position_z
        double velocity_x
        double velocity_y
        double velocity_z
    }
    CONJUNCTION_EVENTS {
        int id PK
        int primary_norad FK
        int secondary_norad FK
        timestamp tca
        double miss_distance
        double radial
        double in_track
        double cross_track
        double pc
        jsonb covariance_matrix
        string compliance_status
    }
    REENTRY_ALERTS {
        int norad_id PK, FK
        string name
        double current_altitude
        double decay_rate
        timestamp eta
        double uncertainty_hours
        double survival_pct
        geometry corridor_geom "PostGIS Polygon (SRID 4326)"
        double casualty_probability
    }
    COMPLIANCE_FILINGS {
        int id PK
        string operator
        string satellite
        timestamp tca
        jsonb form_data
        string pdf_path
        string status
        timestamp submitted_at
    }
```

---

## 🚀 Setup & Execution

### Option A: Production-Grade Containerized Deployment (Recommended)
Launch the database, FastAPI backend, and Nginx frontend in seconds using Docker Compose:
```bash
docker compose up --build -d
```
- **React Frontend**: served at `http://localhost/`
- **FastAPI API Swagger Documentation**: served at `http://localhost:8000/docs`
- **PostGIS DB**: exposed at `localhost:5432`

*Note: On first run, the database automatically creates tables and runs `db/migrations/init_db.sql`.*

### Option B: Local Development Setup
#### 1. Backend Setup
1. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # macOS/Linux
   ```
2. Install Python packages:
   ```bash
   pip install -r requirements.txt -r backend/requirements.txt
   ```
3. Seed the local sqlite database:
   ```bash
   python -m backend.seed_db
   python -m backend.seed_reentry
   ```
4. Run the development server:
   ```bash
   python -m backend.main
   ```

#### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd orbitguard-frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

---

## 🧪 Testing & Verification

Run the comprehensive integration and unit test suites:
```bash
# Set PYTHONPATH to the root directory
$env:PYTHONPATH="." # Windows PowerShell
export PYTHONPATH="." # Bash

# Run all test modules
.venv\Scripts\pytest
```

To run production validation checks against the API:
```bash
python -m backend.verify_production
```
This script runs latency diagnostics on SQLAlchemy database querying, SGP4 performance tests, and validates Ollama connectivity.
