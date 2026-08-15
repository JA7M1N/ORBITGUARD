# OrbitGuard: Math, Physics, and Astrophysics Concepts Reference

This document serves as the theoretical and mathematical handbook for the **Lead Orbital Dynamics & Simulation Engineer** role. It compiles every physics, astrodynamics, and mathematical concept implemented across the OrbitGuard platform.

---

## 🏛️ Fundamental Laws of Physics & Astrophysical Principles Used

Here is a list of the specific laws and principles of physics applied in the OrbitGuard engine:

1. **Newton's Law of Universal Gravitation:** Governs the primary gravitational acceleration ($-\frac{\mu}{r^3} \mathbf{r}$) keeping satellites in orbit.
2. **Newton's Second Law of Motion ($\mathbf{F} = m\mathbf{a}$):** The foundation of the numerical propagators. The sum of gravitational, perturbation ($J_2$), and drag forces are divided by mass to integrate acceleration into velocity and position over time.
3. **Kepler's Laws of Planetary Motion:** 
   * *First Law:* Satellite orbits are ellipses with the Earth at one focus (modeled via eccentricity $e$).
   * *Second Law:* A line segment joining a satellite and Earth sweeps out equal areas during equal intervals of time.
   * *Third Law:* The square of the orbital period ($T$) is directly proportional to the cube of the semi-major axis ($a$) of its orbit.
4. **Coriolis Effect & Rotational Frame Mechanics:** Applied when transforming Cartesian states from the inertial True Equator Mean Equinox (TEME) frame to the rotating Earth-Centered Earth-Fixed (ECEF) frame, adding Coriolis velocity corrections ($\boldsymbol{\omega}_e \times \mathbf{r}$).
5. **J2 Gravitational Oblateness (Non-Spherical Earth Perturbation):** Explains how Earth's equatorial bulge (caused by centrifugal force from rotation) shifts orbits over time, causing nodal precession and apsidal drift.
6. **Aerodynamic / Atmospheric Drag:** The fluid dynamics principle governing orbital decay:
   $$\mathbf{f}_{\text{drag}} = -\frac{1}{2} \rho C_d A v_{\text{rel}} \mathbf{v}_{\text{rel}}$$
7. **Restricted Three-Body Gravitational Problem (CR3BP):** The astrophysics principle governing trajectories in deep space (cislunar), where a spacecraft's mass is negligible compared to the rotating Earth and Moon, allowing orbits around Lagrange points (L1/L2 Halo orbits).
8. **Clohessy-Wiltshire (Euler-Hill) Linearized Relative Motion:** Linearized equations of motion derived from Newton's laws in a rotating coordinate system, approximating the relative positions of two close satellites.

---

## 🧮 Core Mathematical & Statistical Terms Defined

The mathematical structures used to calculate orbital positions and risks:

1. **Cartesian State Vector ($\mathbf{x} = [\mathbf{r}, \mathbf{v}]^T$):** The 6D representation of a spacecraft's position ($\mathbf{r} = [x, y, z]$) and velocity ($\mathbf{v} = [v_x, v_y, v_z]$).
2. **Covariance Matrix ($\mathbf{C}$):** A symmetric $3\times3$ (or $6\times6$) matrix representing the spatial uncertainty and error distribution of the satellite's position.
3. **Eigenvalue Diagonalization:** Projecting the 2D B-plane covariance matrix ($\boldsymbol{\Sigma}_B$) and computing its eigenvalues to find the principal standard deviations ($\sigma_x^2, \sigma_y^2$) and the rotation angle of the collision uncertainty ellipse.
4. **Mahalanobis Distance ($u$):** The multi-dimensional generalization of measuring how many standard deviations the relative position of the satellite is from the center of the covariance ellipse.
5. **Rician Probability Density Function & Bessel Functions:** The probability distribution used in Chan's formula to solve the 2D Gaussian integral of collision probability analytically.
6. **Numerical Integration (Runge-Kutta 4th Order / RK4):** A numerical method for solving ordinary differential equations by evaluating derivatives at weighted intervals to propagate orbital decay trajectories.
7. **Convex Hull (GeoJSON Landing Footprint):** A computational geometry algorithm used to find the boundary of the polygon enclosing all Monte Carlo reentry touchdown coordinates.
8. **Stereographic Conformal Projection:** Mapping a sphere (the Moon's South Pole) onto a flat 2D plane to avoid division-by-zero singularities at $\text{lat} = -90^\circ$ during pathfinding.
9. **A\* Search Graph Pathfinding:** An optimization algorithm that uses a heuristic to find the shortest path across a grid map while minimizing traversal costs (slope, shadows).
10. **Bayesian State Refinement (Information Filter):** Evaluates ground station tracking inputs by adding the inverse of measurement noise to the inverse of prior covariance to reduce the overall uncertainty trace.

---


## 🛰️ 1. Keplerian Orbital Elements & SGP4 Propagation

To represent and track satellite orbits, OrbitGuard uses standard orbital mechanics models.

### Keplerian Orbit Parametrization
A satellite's position in space is described using six Keplerian elements in the Geocentric Equatorial Frame (ECI):
1. **Semi-Major Axis ($a$):** Determines the size of the orbit (km).
2. **Eccentricity ($e$):** Determines the shape of the orbit (circular $e=0$, elliptical $0 < e < 1$).
3. **Inclination ($i$):** Tilt of the orbit plane relative to the Earth's equator (degrees).
4. **Right Ascension of the Ascending Node ($\Omega$ / RAAN):** The angle from the vernal equinox to the ascending node where the satellite crosses the equator from south to north (degrees).
5. **Argument of Perigee ($\omega$):** The angle from the ascending node to the point of closest approach to Earth (perigee) (degrees).
6. **Mean Anomaly ($M$):** Position of the satellite along the orbit relative to perigee, parameterized by time (degrees).

### SGP4 (Simplified General Perturbations 4)
For low-altitude near-Earth satellites (periods < 225 minutes), raw state vectors are propagated from Two-Line Element (TLE) sets using the SGP4 analytical model. It accounts for:
*   **Gravitational Perturbations:** $J_2, J_3,$ and $J_4$ zonal harmonics representing the Earth's non-spherical shape (oblateness).
*   **Atmospheric Drag:** Uses a simplified power-law model scaled by the satellite's drag coefficient $B^*$ (B-star).
*   **Third-Body Gravity:** Lunar and solar gravitational perturbations.

---

## 🔄 2. Coordinate System Transformations

Transforming position and velocity vectors between reference frames is critical for 3D visualization and physics equations.

### TEME (True Equator Mean Equinox) to ECEF (Earth-Centered Earth-Fixed)
SGP4 outputs Cartesian states in the quasi-inertial TEME frame. To map them to coordinates on the rotating Earth (WGS84 ellipsoid), we apply a rotation by the Greenwich Mean Sidereal Time (GMST) angle $\theta$:

$$\mathbf{r}_{ECEF} = \mathbf{R}_z(\theta) \mathbf{r}_{TEME}$$

$$\mathbf{v}_{ECEF} = \mathbf{R}_z(\theta) \mathbf{v}_{TEME} - \boldsymbol{\omega}_e \times \mathbf{r}_{ECEF}$$

where $\boldsymbol{\omega}_e = [0, 0, \omega_e]^T$ is the Earth's angular rotation vector ($\omega_e \approx 7.292115 \times 10^{-5} \text{ rad/s}$), which introduces Coriolis corrections to the velocity vector.

### RIC (Radial, In-Track, Cross-Track) Local Frame
For maneuver planning, burn offsets are specified in the RIC frame centered on the primary satellite:
*   **Radial ($\hat{R}$):** Points along the position vector from Earth center to satellite.
*   **In-Track ($\hat{I}$):** Perpendicular to Radial, pointing along the direction of motion.
*   **Cross-Track ($\hat{C}$):** Normal to the orbital plane (along the angular momentum vector).

---

## ☄️ 3. Conjunction Analysis & Probability of Collision ($P_c$)

Evaluating close approach risks requires projecting uncertainties and calculating overlap probabilities.

### B-Plane Encounter Projection
At the Time of Closest Approach (TCA), the relative state is projected onto the B-plane (perpendicular to the relative velocity vector $\mathbf{v}_{\text{rel}}$):
1.  **Axes definition:**
    *   $\hat{\mathbf{e}}_z = \frac{\mathbf{v}_{\text{rel}}}{\|\mathbf{v}_{\text{rel}}\|_2}$
    *   $\hat{\mathbf{e}}_x = \frac{\mathbf{ref} \times \hat{\mathbf{e}}_z}{\|\mathbf{ref} \times \hat{\mathbf{e}}_z\|_2}$
    *   $\hat{\mathbf{e}}_y = \hat{\mathbf{e}}_z \times \hat{\mathbf{e}}_x$
2.  **Covariance Mapping:** The combined covariance $\mathbf{C} = \mathbf{C}_p + \mathbf{C}_s$ is projected onto the 2D B-plane:
    $$\boldsymbol{\Sigma}_B = \mathbf{P} \mathbf{C} \mathbf{P}^T$$
    where $\mathbf{P} = [\hat{\mathbf{e}}_x, \hat{\mathbf{e}}_y]^T$ is the projection matrix.

### Chan's Analytical $P_c$ Method
Rather than integrating the 2D Gaussian density numerically, Chan's method diagonalizes the covariance to principal axes ($\sigma_x, \sigma_y$) and computes $P_c$ using a converging Rician series with Bessel functions:
$$P_c = e^{-\frac{u}{2}} \sum_{k=0}^{\infty} \frac{1}{k!} \left(\frac{u}{2}\right)^k P\left(k+1, \frac{\beta^2}{2}\right)$$
where $u$ is the Mahalanobis distance based on B-plane miss distance, and $\beta$ represents the Hard Body Radius (HBR) normalized by standard deviations.

---

## 🌀 4. High-Fidelity Orbital Decay & Atmospheric Drag

At very low altitudes ($< 250$ km), SGP4 fails. OrbitGuard switches to a high-fidelity numerical propagator.

### Equations of Motion (RK4 Integration)
State propagation uses a Runge-Kutta 4th Order numerical integrator solving:
$$\mathbf{a}_{\text{total}} = -\frac{\mu}{r^3} \mathbf{r} + \mathbf{a}_{J2} + \mathbf{a}_{\text{drag}}$$

### J2 Oblate Gravity Acceleration
$$\mathbf{a}_{J2} = \frac{3 J_2 \mu R_E^2}{2 r^5} \begin{bmatrix} x \left(5 \frac{z^2}{r^2} - 1\right) \\ y \left(5 \frac{z^2}{r^2} - 1\right) \\ z \left(5 \frac{z^2}{r^2} - 3\right) \end{bmatrix}$$
Verification audits guarantee that J2 scaling coordinates match Earth's physical oblate gravitational constants correctly.

### Drag Acceleration (NRLMSISE-00 Density Scaling)
$$\mathbf{a}_{\text{drag}} = -\frac{1}{2} C_d \left(\frac{A}{m}\right) \rho v_{\text{rel}} \mathbf{v}_{\text{rel}}$$
where:
* The satellite's velocity relative to the rotating atmosphere is computed as $\mathbf{v}_{\text{rel}} = \mathbf{v} - \boldsymbol{\omega}_E \times \mathbf{r} = [v_x + \omega_E y, v_y - \omega_E x, v_z]^T$ (with Earth's angular spin velocity $\omega_E \approx 7.292115 \times 10^{-5} \text{ rad/s}$).
* Density $\rho$ is determined using the scale-height model and dynamically adjusted based on real-time solar indices ($F_{10.7}$) and geomagnetic indices ($A_p$).

### Trajectory Path Hermite Interpolation
To prevent visual trajectories from cutting through the Earth's sphere, 3D path coordinates are propagated as 7-tuples `[epoch, x, y, z, vx, vy, vz]` in ECI space, allowing the Cesium client to apply Hermite spline interpolation natively over sparse states.

### Monte Carlo Landing Footprints
Runs 100 parallel integrations with Gaussian noise applied to $C_d$, $\rho$, and initial altitude vectors. The dispersion of reentry points (altitudes $< 80$ km) is mapped to establish a geographical risk polygon.

---

## ☀️ 5. Solar Physics & CME Propagator (Aditya-L1 Model)

To model space weather storms that cause thermospheric expansion (increasing drag on LEO satellites):
*   **Solar Flare Rise Phase:** Telemetry counts from Soft/Hard X-rays are modeled exponentially:
    $$F(t) = F_0 \cdot e^{\lambda (t - t_0)}$$
*   **Coronal Mass Ejection (CME) Transit:** The velocity $v_{\text{CME}}$ determines travel time to Earth:
    $$t_{\text{transit}} = \frac{1.496 \times 10^8 \text{ km}}{v_{\text{CME}} \cdot 3600} \text{ (hours)}$$
*   **Ionospheric Impact:** CME arrival scales the local $F_{10.7}$ and $A_p$ parameters, magnifying orbital decay rates by up to $3.5\times$.

---

## 🌙 6. Cislunar Mechanics & Deep Space Trajectories

For missions operating beyond Earth orbit, OrbitGuard uses multi-body gravitational models.

### Circular Restricted 3-Body Problem (CR3BP)
Simulates orbits in the Earth-Moon barycentric rotating frame. The satellite experiences gravitational forces from two primary rotating bodies simultaneously:
$$\ddot{\vec{r}} = -\mu_E \frac{\vec{r}}{|\vec{r}|^3} - \mu_M \frac{\vec{r} - \vec{r}_M(t)}{|\vec{r} - \vec{r}_M(t)|^3}$$
Used to model Lagrange point orbits (L1, L2, Halo trajectories, and Near-Rectilinear Halo Orbits - NRHO).

### Polar Stereographic Projection & Pathfinding (Moon South Pole)
To calculate traversal corridors near the Moon's South Pole ($\text{lat} \in [-90^\circ, -85^\circ]$) without encountering coordinate singularities at $90^\circ \text{ S}$:
1.  **Cartesian stereographic coordinate projection:**
    $$x = (\text{lat} + 90) \cdot \cos(\text{lon}_{\text{rad}})$$
    $$y = (\text{lat} + 90) \cdot \sin(\text{lon}_{\text{rad}})$$
2.  **A* Pathfinder Traversal Cost:** Evaluates slope and shadow hazard grids inside and outside craters. Crater core interiors are treated as completely impassable boundaries (infinite cost penalty: `float('inf')`), preventing rover traversal through steep, dangerous craters unless they represent the start or destination coordinates (within `5.0 km` safety buffer).

---

## 🛡️ 7. Collision Avoidance Maneuver (CAM) Coordinate Mechanics

### Clohessy-Wiltshire (CW) Relative Motion Equations
To calculate maneuver delta-V vectors relative to a target orbital path:
$$\ddot{x} - 2n\dot{y} - 3n^2x = f_x$$
$$\ddot{y} + 2n\dot{x} = f_y$$
$$\ddot{z} + n^2z = f_z$$
where $n$ is the target's mean motion.

### CCSDS OPM Maneuver Standards
Exported maneuvers are mapped to standard CCSDS Orbit Parameter Message templates representing radial, in-track, and cross-track burns in the RIC local frame.
