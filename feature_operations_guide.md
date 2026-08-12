# OrbitGuard: Operational Feature & User Interface Guide

This guide provides a comprehensive breakdown of every page, card, button, toggle, and visual component in the OrbitGuard Space Situational Awareness (SSA) dashboard. Use this to explain the system like a mission operations director.

---

## 1. 🌍 3D Live Orbit Globe (Map Interface)

The central visual dashboard representing a real-time, WebGL-rendered 3D Earth space environment.

#### 🧠 The Logic (How it works)
* Translates satellite SGP4 orbital element state vectors $[x, y, z]$ into Earth-Centered Inertial (ECI) coordinate positions over time. We stream these coordinates via backend-generated CZML files to the client. The 3D canvas coordinates are synced to the viewer time, showing orbits and ground-points.

#### ⚠️ Problems Solved
* Prior to 3D rendering, operators had to interpret complex 2D ground track maps that distort altitude clearances and polar crossings. Renders a physical spatial representation of the satellite catalog, showing active constellations, sensors, and debris zones in real time.

### A. Satellite & Debris Visual Points (On Globe)
* **Active Payloads (Blue Dots):** Represents operational satellites currently broadcasting telemetry (e.g., Starlink communications satellites, ISRO's Cartosat imaging satellites, and the International Space Station).
* **Space Debris (Red Dots):** Represents spent rocket booster stages, discarded fairings, and structural fragments resulting from historical orbital collisions (such as the Fengyun-1C anti-satellite test debris cloud or the Iridium 33-Cosmos 2251 collision cloud).
* **Decluttered View:** By default, no orbital path lines are drawn to keep the globe clean. Clicking on any dot instantly reveals its single orbital path line.

### B. Map Controller Panel (Sidebar controls)
* **Layer Visibility Card:**
  * **SPACE DEBRIS (Toggle):** Hides/reveals the red debris fragment dots.
  * **ACTIVE PAYLOADS (Toggle):** Hides/reveals the blue operational satellite dots.
  * **GROUND RADAR SENSORS (Toggle):** Renders ground tracking station points on the Earth's surface (Bengaluru, Svalbard, California, South Africa) surrounded by **blue 800 km coverage cones**. These represent the radar capture zone where the station can lock on to and track space objects.
  * **ORBITAL HAZARD SHELLS (Toggle):** Renders two hollow 3D spheres centered on Earth:
    * **Red Polar Debris Shell (700-900 km):** High-density zone representing where orbital debris clusters in polar orbits.
    * **Amber Constellation Shell (350-550 km):** High-density zone representing LEO megaconstellations (like Starlink).
* **Catalog Capacity Slider:** Restricts the density of loaded satellites from the SQLite/PostgreSQL database to control GPU rendering limits.
* **Propagation Multiplier speed buttons:** Speeds up Cesium's clock from 1x (real-time) to 3600x (one hour of orbit passes in one second) to let you inspect future satellite paths.

### C. Floating Satellite Search & Operator Filters (Top-Right Overlay)
* **Search input:** Type a name or NORAD ID. A dynamic dropdown lists the closest matches. Clicking one highlights the satellite, opens the telemetry HUD, and flies the camera to focus on it.
* **Operator Dropdown:** Filters the visible satellites on the globe by operator (e.g. SpaceX/Starlink, ISRO, NASA, ESA, Roscosmos).

### D. Telemetry HUD Card (Bottom-Left Overlay)
Opens when a satellite is selected, displaying live orbital metrics:
* **NORAD ID:** The unique registry number assigned by US Space Command.
* **Altitude (km):** Real-time height above Earth's reference ellipsoid.
* **Velocity (km/s):** Current speed along its orbit trajectory (usually ~7.5 km/s for LEO).
* **Latitude/Longitude (°):** The nadir (ground-point) coordinates directly beneath the satellite.
* **Space Weather Drag Impact Panel:**
  * **Orbital Drag status:** Categorizes drag based on altitude and solar wind (Nominal, Moderate, Elevated, Critical).
  * **Decay Rate:** Expected altitude loss per day (e.g. `12.4 m/day` for LEO objects during solar storms).
  * **Drag Multiplier:** The density expansion scale (e.g. `2.5x` during space weather storms).
* **Simulate Burn (Radial) Slider:** Accessible when tracking is active. Sliding from -50 m/s to +50 m/s plots a **dotted yellow line** representing the simulated shifted trajectory resulting from a thruster burn.
* **Action Buttons:**
  * **Track Orbit:** Locks the camera frame to the satellite in its local VVLH frame. The camera flies in parallel at the exact same orbital speed, showing the Earth rotating below. Pressing **`Esc`** breaks this lock and flies back to global view.
  * **Pin Trajectory:** Pins the orbit line, keeping it rendered on the globe even if you click another satellite (allows visual comparison of multiple orbits).

---

## 2. 🚨 Conjunction Avoidance Hub (Collision Warning Center)

The dashboard used to plan evasive maneuvers when two space objects are projected to pass dangerously close to each other.

#### 🧠 The Logic (How it works)
* Projects relative 3D satellite position states and covariance ellipsoid uncertainties onto a 2D B-plane (Encounter Plane) perpendicular to the relative velocity vector at TCA. Solves the collision probability ($P_c$) analytically using Foster-Elrod Rician Bessel integration.

#### ⚠️ Problems Solved
* Resolving collision risks using standard numerical integration is computationally slow, preventing real-time thruster sliders. The Foster-Elrod analytical formula evaluates risks in under $0.1\text{ ms}$, allowing operators to slide burn sliders and see risk recalculate instantly.

### A. Conjunction Event List (Left Panel)
* Displays upcoming close-approach threat events sorted by time.
* **Threat Badges:**
  * **CRITICAL (Red):** Probability of Collision ($P_c \ge 10^{-4}$). Immediate action required.
  * **WARNING (Yellow):** Probability of Collision ($10^{-6} \le P_c < 10^{-4}$). Monitor closely.
  * **NOMINAL (Green):** Probability of Collision ($P_c < 10^{-6}$). Safe.
* **Search & Filters:** Filter the list by threat level or search by satellite names.

### B. Event Details & Countdown (Right Panel)
* **TCA Live Countdown Clock:** A digital clock counting down to the Time of Closest Approach (`Hours : Minutes : Seconds : Milliseconds`). It flashes red and pulses when the encounter is less than 6 hours away.
* **Miss Distance (km):** The relative distance between the two objects at their closest point.
* **Collision Probability:** Derived using Chan's analytical model.
* **RIC Relative Vectors:** Relative distance broken down into the Radial (outward), In-Track (along velocity), and Cross-Track (perpendicular) axes.

### C. Interactive 2D B-Plane Plotter (Center Panel)
* Represents a cross-section of the encounter area perpendicular to the relative velocity.
* **Covariance Ellipses:** Renders the 1-sigma, 2-sigma, and 3-sigma uncertainty boundaries of the secondary object relative to the primary object (centered in the crosshair).
* **Secondary Marker (Red Dot):** Displays where the secondary object will pass. If the dot lies inside the inner red ellipse, the risk is critical.

### D. Evasive Maneuver Planner (Sliders)
* Three sliders representing a thruster burn applied to the primary satellite:
  * **Radial Burn (m/s):** Thrusting directly away/toward Earth.
  * **In-Track Burn (m/s):** Thrusting along/against the velocity vector.
  * **Cross-Track Burn (m/s):** Thrusting left/right relative to the orbit plane.
* **Interactive updates:** Sliding these values dynamically shifts the red secondary marker on the B-plane plot, re-calculates the probability of collision ($P_c$) in real time, and updates the threat rating badge from Critical to Nominal, showing how the maneuver clears the hazard.

---

## 3. ☄️ Decay & Reentry Risk Console

Tracks space debris and satellites whose orbits are degrading, leading to atmospheric reentry.

#### 🧠 The Logic (How it works)
* Executes a high-fidelity Runge-Kutta 4th-order numerical integration of the satellite's state, accounting for oblate Earth gravity (J2 harmonics) and co-rotating atmospheric drag. Runs a 100-run Monte Carlo simulation (varying density and drag coefficients) to output a convex hull dispersion landing footprint.

#### ⚠️ Problems Solved
* Orbital decay and breakup locations are highly sensitive to small variations in thermospheric temperature and drag surfaces. Providing a single point prediction is unsafe; mapping a statistical landing corridor overlay on Leaflet gives ground teams a realistic warning footprint.

### A. Decay Alerts Sidebar (Left Panel)
Lists satellites orbiting below 250 km (where atmospheric density increases exponentially, dragging the object down). Shows name, current altitude, and daily decay rate.

### B. Telemetry Metrics Card (Right Panel)
* **Current Altitude:** Height in km.
* **Fragment Survival Rate (%):** Estimated fraction of the satellite's mass that will survive atmospheric frictional heating (metal melting points) and reach the ground.
* **Casualty Risk ($E_c$):** The statistical probability that debris fragments will land on populated areas, mapped against human casualty thresholds (e.g. $1:10,000$ limit).

### C. Decay & Space Weather Correlation Chart
* A dual-axis line chart:
  * **Altitude (Red Solid Line):** The decaying altitude of the satellite over the last 7 days.
  * **Storm Index (Purple Dashed Line):** The NOAA geomagnetic $K_p$ index over the last 7 days.
* **How it explains physics:** You will see a sharp drop in altitude precisely when the storm index spikes (representing the geomagnetic storm heating the atmosphere, expanding density, and increasing drag).

### D. Landing Corridor Footprint Map
* An interactive Leaflet map displaying a **red GeoJSON polygon ellipse** on the Earth's surface.
* **What it represents:** The projected debris landing corridor generated by the backend's 100-run Monte Carlo integration, accounting for variations in atmospheric density, wind currents, and drag coefficients.

---

## 4. 🌦️ NOAA & Aditya-L1 Space Weather Dashboard

Tracks solar activity, flare eruptions, and coronal mass ejection (CME) trajectories influencing LEO atmospheric drag.

### A. Aditya-L1 Solar Flare Monitor (Live Scrolling Chart)
* Renders a real-time scrolling graph plotting simulated X-ray flux readings from the **SoLEXS** spectrograph (Soft X-ray flux, 1-8 Å) and counts from the **HEL1OS** spectrograph (Hard X-ray counts, 10-150 keV).
* **The Physics/Logic:** Displays baseline solar noise fluctuations. When a flare is triggered, it shows an exponential flare rise, peak saturation, and a gradual logarithmic decay phase.

### B. Active CME Warning Banner & Impact Countdown
* Mounts at the top of the weather console when a flare is active.
* **CME Speed Indicator:** Displays the estimated CME ejecta velocity in km/s (e.g. `1,250 km/s`).
* **Astronomical Distance Progress Bar:** A visual slider showing the CME's distance from the Sun to Earth in AU (Astronomical Units).
* **Impact Countdown Timer:** Computes a time-compressed countdown (spanning 45 to 120 seconds for demonstration, representing a real-world 15–30 hour transit) indicating when the geomagnetic storm will hit Earth's magnetosphere.

### C. Simulation Controls & Manual Triggers
* **Trigger M-Class / X-Class Flare (Buttons):** Inject simulated solar eruptions of varying scales.
* **Clear Solar Storm (Button):** Immediately resets the state file and clears active warnings, returning the space environment to nominal solar weather.

### D. At-Risk LEO Satellites Table
* Lists satellites orbiting in low altitudes most vulnerable to storm-induced drag.
* **Decay Rate Surge Column:** Displays the baseline decay rate vs. the storm-induced decay rate (e.g., from `11.2 m/day` scaling to `39.2 m/day` under X-class geomagnetic heating).

---

## 5. 🏛️ Compliance Hub & Swarm Agent Page

Handles regulatory reporting of maneuvers to government space traffic entities (like IN-SPACe).

#### 🧠 The Logic (How it works)
* Orchestrates a pipeline of 6 specialized, autonomous AI agents (Ingestion, Astrodynamics, Risk, Legal, Mitigation, Filing) communicating via WebSockets. The legal agent queries local LLMs via Ollama to write justifications, and the filing agent compiles printable ReportLab PDFs.

#### ⚠️ Problems Solved
* Preparing space safety disclosures requires complex calculations and manual form completions, taking flight teams hours during time-critical conjunction events. Automates this pipeline, generating and filing a regulatory PDF report in under 15 seconds.

### A. Compliance Hub List (Compliance Page)
* **Manual Regulatory Filing Form:** Lets operators choose a conjunction event, input the planned maneuver burn vector (Radial, In-track, Cross-track), write a policy justification, and click **Submit Regulatory Filing**.
* **Submitted Filings Panel:** Registers every filing in a table, displaying submission times, maneuver plans, and a **Download PDF** button to retrieve the compiled regulatory compliance report.

### B. Agent Swarm Page (Automated AI Swarm)
* **Initiate Pipeline Button:** Triggers a 6-agent AI swarm to resolve conjunction events autonomously.
* **Glowing flow diagram:** Displays the execution pathway in real time, shifting node colors as the agents ingest data, run astrodynamics calculations, assess risk, draft legal justifications, plan maneuver burns, and compile the final PDF compliance filing.
* **Download Swarm PDF Report:** A green button appearing upon pipeline completion to instantly download the generated report.

---

## 6. 💬 Secure AI Copilot Console

An air-gapped, conversational assistant designed to answer mission queries while securing sensitive operational telemetries.

#### 🧠 The Logic (How it works)
* Uses Retrieval-Augmented Generation (RAG). A backend regex parser scans messages for satellite names or NORAD IDs, pulls database rows (`Satellite`, `ConjunctionEvent`, `ReentryAlert`), and feeds them as system context to a local Llama 3.2 instance.

#### ⚠️ Problems Solved
* Querying cloud-based AI engines (like ChatGPT) uploads confidential military and commercial telemetry data to public servers, violating aerospace operational security. Running the LLM locally on an air-gapped server secures all data. If the AI service is offline, a local rule-engine fallback generates structured text reports.

### A. RAG-Enabled Chat Canvas
* **Message Bubble History:** Displays structured dialogue between the operator and the copilot.
* **Typing Indicator:** Shows when the copilot is querying the database or generating response strings.

### B. Security & Connectivity Indicator
* Displays **"Local Llama 3.2 Active (Air-Gapped)"** (Green) when the local Ollama server is responsive.
* Displays **"Database Reporting Mode (Offline Fallback)"** (Amber) if the LLM goes offline, indicating that the system is pulling raw SQL records to compile a fallback report.

### C. Suggestion Chips & Quick Queries
* Button shortcuts enabling one-click checks for active conjunction threats, LEO decay lists, or space weather parameters.

---

## 7. 🌙 Lunar Safety Hub (Lunar South Pole Dashboard)

Provides surface hazard monitoring and waypoint path planning near the Lunar South Pole for rovers and landers.

#### 🧠 The Logic (How it works)
* Employs a polar stereographic projection to map lat/lon coordinates to a Cartesian grid near the south pole. Solves optimal traverse paths using a slope-aware A* search algorithm where craters act as steep cost obstacles. Renders the waypoints on a custom Moon ellipsoid globe in CesiumJS.

#### ⚠️ Problems Solved
* Polar regions present severe coordinate distortion and terrain hazards (craters, deep shadows, cliffs). The stereographic A* solver maps safe routes, preventing rovers from sliding down crater walls or entering shadowed basins where they lose solar power.

### A. 3D Lunar Cesium Globe
* A customized 3D WebGL ellipsoid set to the Moon's physical radius ($1,737.4\text{ km}$).
* **Spherical Lunar Imagery:** Renders a high-resolution flat-cylindrical grayscale lunar surface map.
* **Crater Hazard Overlays (Red Circles):** Highlights polar craters (Shackleton, Shoemaker, Faustini) representing deep shadows, extreme slopes, and communication blockages.
* **Waypoint Trajectory (Cyan Line):** Displays the neon cyan route waypoints calculated by the pathfinder.

### B. Mission Selector & Waypoints Telemetry
* **Mission Target Selector (Dropdown):** Choose preset traverse routes (e.g. *Landing Site Alpha to Shackleton Rim*).
* **Coordinate Inputs:** Set starting and target Lat/Lon values to calculate custom paths.
* **Path Telemetry Cards:**
  * **Total Length (km):** The overall travel distance of the computed path.
  * **Max Gradient (°):** The steepest slope encountered along the route.
  * **Path Safety Index (%):** A safety rating based on the slope profile (warnings display if the slope exceeds 15°).
  * **Waypoints Table:** Lists the latitude, longitude, and slope gradient of each computed node.

