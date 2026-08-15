# OrbitGuard: Lead Orbital Dynamics & Simulation Engineer Concepts

This document outlines the software design, library integrations, and algorithmic execution flows maintained by the **Lead Orbital Dynamics & Simulation Engineer**.

---

## 🛠️ 1. Core Simulation Libraries & SDKs

The dynamics engine is implemented in Python, leveraging industry-standard aerospace and scientific libraries:
*   **`sgp4` (Python/C++ Port):** Directly executes the Simplified General Perturbations 4 analytical propagation model using TLE sets, returning ECI position and velocity.
*   **`skyfield`:** Used for coordinate frame handling, celestial bodies positions (e.g., Earth-Moon vectors), and handling timescale objects.
*   **`numpy`:** Vectorizes calculation arrays for 3D coordinate rotations, relative velocity calculations, and Monte Carlo perturbation arrays.
*   **`scipy.special`:** Utilized for `ive` (exponentially scaled modified Bessel functions of the first kind) to solve Chan's probability series without floating-point overflow.

---

## 🏎️ 2. Collision Screening Algorithm (3D KD-Tree)

The screening engine processes satellite catalogs in two steps to identify conjunction candidates:
1.  **Epoch Alignment:** Propagates all active database satellites to the same epoch slices using vectorized SGP4 calls.
2.  **Spatial Querying:** Builds a `scipy.spatial.KDTree` of all satellite 3D ECI positions. A dual-tree neighbor search is run with a safety threshold (e.g., 50 km).
3.  **Output:** Generates a list of candidate pairs, skipping $O(N^2)$ comparisons and reducing complex covariance computations to a subset of targets.

---

## 🧮 3. Covariance Projection & Chan's Probability Pipeline

Once a candidate pair is screened:
1.  **TCA Solvers:** Solves for the exact Time of Closest Approach ($\text{TCA}$) by finding the local minimum of the relative position vector magnitude:
    $$f(t) = \|\mathbf{r}_p(t) - \mathbf{r}_s(t)\|$$
2.  **B-Plane Alignment:** Rotates the combined 3D positional covariance $\mathbf{C} = \mathbf{C}_p + \mathbf{C}_s$ into the 2D B-plane.
3.  **Diagonalization & Eigenvalues:** Computes the eigenvalues of the B-plane covariance to establish the principal axes of the uncertainty ellipse ($\sigma_x^2, \sigma_y^2$).
4.  **Chan Series Solution:** Solves the probability of collision ($P_c$) analytically using Rician series expansion:
    $$P_c = e^{-\frac{u}{2}} \sum_{k=0}^{\infty} \frac{1}{k!} \left(\frac{u}{2}\right)^k P\left(k+1, \frac{\beta^2}{2}\right)$$

---

## 🌀 4. Numerical Decay Propagator Architecture

For low Earth orbits ($< 250$ km), analytical models fail. The numerical propagator runs a fourth-order Runge-Kutta (RK4) integration loop:
1.  **State Derivation:** Computes the state derivative $\mathbf{f}(t, \mathbf{x}) = [\mathbf{v}, \mathbf{a}]^T$.
2.  **Force Accumulation:**
    *   **Newtonian Gravity:** $-\frac{\mu}{r^3} \mathbf{r}$
    *   **J2 Earth Oblateness:** Non-spherical gravity acceleration terms.
    *   **Atmospheric Drag:** $-\frac{1}{2} C_d \frac{A}{m} \rho v_{\text{rel}} \mathbf{v}_{\text{rel}}$ where density $\rho$ is scaled by live space weather.
3.  **RK4 Integration Step:**
    $$\mathbf{k}_1 = \Delta t \cdot \mathbf{f}(t_n, \mathbf{x}_n)$$
    $$\mathbf{k}_2 = \Delta t \cdot \mathbf{f}\left(t_n + \frac{\Delta t}{2}, \mathbf{x}_n + \frac{\mathbf{k}_1}{2}\right)$$
    $$\mathbf{k}_3 = \Delta t \cdot \mathbf{f}\left(t_n + \frac{\Delta t}{2}, \mathbf{x}_n + \frac{\mathbf{k}_2}{2}\right)$$
    $$\mathbf{k}_4 = \Delta t \cdot \mathbf{f}(t_n + \Delta t, \mathbf{x}_n + \mathbf{k}_3)$$
    $$\mathbf{x}_{n+1} = \mathbf{x}_n + \frac{1}{6}(\mathbf{k}_1 + 2\mathbf{k}_2 + 2\mathbf{k}_3 + \mathbf{k}_4)$$
4.  **Termination Condition:** Integrates until the altitude drops below 80 km (the break-up boundary).

---

## ☀️ 5. Solar Flare & CME Propagation Modeling

To calculate changes in thermospheric expansion:
*   **Solar Flare Modeling:** Simulates soft/hard X-ray counts representing flare rise phases.
*   **CME Velocity Mapping:** Determines CME travel velocities, calculating Earth transit durations.
*   **Drag Scaling:** Dynamically scales density indices ($F_{10.7}$, $A_p$) inside the numerical integrator upon CME arrival.

---

## 🌙 6. Cislunar & Deep Space Systems (CR3BP & pathfinding)

*   **Barycentric Rotating Frame:** Formulates the equations of motion for the Circular Restricted 3-Body Problem (CR3BP) to simulate cislunar orbits.
*   **Stereographic Lunar Projection:** Projects polar latitude/longitude coordinates to Cartesian grids to avoid mathematical singularities at the South Pole.
*   **A* Cost Engine:** Evaluates a hazard cost matrix based on topography slope angles and permanent shadow indicators.

---

## 🛡️ 7. Collision Avoidance Maneuver (CAM) Systems

*   **Clohessy-Wiltshire (CW) Solver:** Simulates relative trajectories in the local Euler-Hill frame to calculate required delta-V burns.
*   **CCSDS OPM Exporter:** Maps radial, in-track, and cross-track delta-V changes into standard Consultative Committee for Space Data Systems templates.
