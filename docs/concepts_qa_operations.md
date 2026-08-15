# OrbitGuard: QA & Mission Operations Concepts Reference

This document serves as the technical handbook for the **QA Engineer & Mission Operations Lead** role. It details the testing methodology, edge-case checks, compliance audits, and scenario validation logic used in OrbitGuard.

---

## 🧪 1. Automated Integration & Regression Testing

The automated test suite (`tests/`) uses `pytest` to validate that modifications to OrbitGuard's mathematics or routing do not break core functionality.

### Test Coverage Areas
1.  **SGP4 Propagation & DB Integration (`test_backend_db.py`, `test_ingestion.py`):**
    *   Verifies that satellite TLEs are parsed cleanly into DB records.
    *   Tests that SGP4 correctly returns Cartesian position vectors for any requested epoch.
2.  **Astrodynamics Calculations (`test_conjunction_math.py`):**
    *   Validates the projection of 3D covariances to the 2D B-plane.
    *   Asserts that Chan's probability of collision ($P_c$) calculations remain mathematically stable for varied miss-distances and covariance spreads.
3.  **Atmospheric Decay & Reentry (`test_deorbit.py`, `test_decay_reentry.py`):**
    *   Tests the Runge-Kutta 4th Order numerical integrator accuracy under J2 perturbations.
    *   Verifies that Monte Carlo decay simulations output valid coordinates upon reaching the 80 km boundary.
4.  **Cislunar & Lunar Pathfinder (`test_lunar.py`, `test_lunar_cislunar.py`):**
    *   Verifies the polar stereographic transformation.
    *   Assures the A* pathfinding algorithm finds the lowest-cost path without getting trapped by high slope values near Lunar crater rims.
5.  **Maneuver Proposal Workflows (`test_negotiation.py`):**
    *   Validates status-state transitions of multilateral maneuver proposals (Proposed, Countered, Accepted, Rejected).
    *   Verifies Clohessy-Wiltshire (CW) delta-V inputs decrease the target collision probability.
6.  **Real-Time Subsystems (`test_ws_connection.py`, `test_solar_pipeline.py`):**
    *   Tests WebSocket connection stability for active conjunction feeds.
    *   Asserts the Space Weather Pipeline correctly updates and scales drag coefficients during high solar flare simulation states.

---

## ⚠️ 2. Boundary Conditions & Numerical Edge-Cases

QA operations monitor and check critical numerical boundaries where physical models could fail:
*   **Near-Zero Inclinations ($i \approx 0$):** SGP4 can encounter singularity divisions if orbital inclination is exactly zero. The model is validated using equatorial geostationary orbits.
*   **Near-Circular Orbits ($e \approx 0$):** Argument of perigee becomes undefined when eccentricity is zero. The system handles this boundary smoothly.
*   **Integrator Step-Size ($\Delta t$):** During atmospheric reentry simulations, as altitude drops, drag forces grow exponentially. A fixed integration step-size that is too large causes numerical divergence (satellites flying out of orbit). The system is verified to maintain stability.
*   **A* Pathfinder Trapping:** Verifies pathfinding does not get stuck in a recursive loop inside craters by checking shadow/slope cost limits.

---

## 📜 3. Regulatory Compliance Auditing (5-Year Deorbit Rules)

A critical operations feature is verifying regulatory compliance for decommissioned spacecraft.

### The 5-Year Rule Check
*   **Requirement:** Low Earth Orbit (LEO) satellites must safely deorbit via atmospheric drag within 5 years of completing their operational life.
*   **Operational Validation:** The system propagates the satellite's altitude decay over a 5-year timeline. If the altitude does not fall below the 80 km breakup threshold within 1,826 days (5 years), the satellite is flagged as **Non-Compliant**.
*   **Audit Brief Verification:** The system compiles compliance metrics into a PDF audit brief using ReportLab. QA verifies page layouts, formatting, and mathematical consistency in the export files.

---

## 🔄 4. Covariance & Maneuver Refinement Validation

### Bayesian Refinement Verification
*   **Objective:** Verifying that ground observations successfully refine a satellite's orbit, shrinking the positional uncertainty.
*   **QA Validation:** Asserts that when new observation data is submitted, the trace of the coordinate covariance matrix $\Sigma$ decreases:
    $$\text{trace}(\Sigma_{\text{refined}}) < \text{trace}(\Sigma_{\text{prior}})$$

### Collision Avoidance Maneuver (CAM) Verification
*   **Objective:** Verifying that a proposed maneuver burn results in satellite safety.
*   **QA Validation:** Propagates both satellites to the original TCA using the maneuvered state vector, asserting that the new miss distance increases and the new probability of collision drops below the safety threshold ($P_c < 10^{-4}$).

---

## 📽️ 5. Scenario Scripting & Walkthroughs

QA scripts specific scenario runs to test system-wide behaviors:
1.  **High-Risk Conjunction Scenario:** Ingests two intersecting TLE datasets, verifies a close conjunction is flagged ($P_c > 10^{-4}$), plans an avoidance maneuver burn, and verifies the hazard is resolved.
2.  **Solar Weather Crisis Scenario:** Triggers a major Solar Flare mock alert from the Aditya-L1 observatory, simulates the CME transit, verifies that LEO atmospheric densities scale up, and monitors the increased orbital decay rates.
