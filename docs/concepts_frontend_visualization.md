# OrbitGuard: 3D Visualization & Frontend Developer Concepts

This document outlines the user interface frameworks, 3D graphics, geographical mapping systems, canvas drawings, and state synchronization engines maintained by the **3D Visualization & Frontend Developer**.

---

## ⚛️ 1. React + Vite Development Environment

OrbitGuard's user interface is built on **React** bundled with **Vite** for rapid loading and Hot Module Replacement (HMR).

### Core Frontend Architectures
*   **Component Architecture:** Organizes the dashboard into reusable functional components (e.g., `SatelliteMap`, `ConjunctionTable`, `ManeuverPanel`, `SpaceWeatherAlerts`).
*   **React Hook State Management:** Uses hooks (`useState`, `useEffect`, `useRef`) to track active configurations, selected satellites, input delta-V values, and WebSocket feed lists.
*   **Asynchronous API Fetching:** Interfaces with FastAPI routers via Axios or Fetch to pull raw TLE lists, compliance audits, and polar pathfinder vectors.

---

## 🎨 2. Premium UI Design & CSS Glassmorphism

To create a visually stunning dashboard (crucial for winning hackathon presentations), OrbitGuard applies premium styling tokens.

### Glassmorphism System
*   **Aesthetics:** High-tech, semi-transparent frosted glass design that aligns with modern dark-mode interfaces.
*   **CSS Backdrop Filter:** Applies `backdrop-filter: blur(12px) saturate(180%)` to allow blurred background components to show through.
*   **Gradients & Accents:** Uses sleek CSS gradients (e.g., deep space blues, neon cyan accents, warning orange alerts) for border highlights and progress bars.
*   **Micro-Animations:** Employs CSS transitions and keyframes to animate alert pulses, sliding panels, and hover states.

---

## 🌐 3. CesiumJS 3D Earth Orbit Visualization

The central component of OrbitGuard is the 3D globe showing live satellite positions and orbits.

### CesiumJS Concepts & Implementation
*   **Cesium Viewer Widget:** Instantiates the WebGL 3D globe centered on Earth.
*   **Orbital Path Plotting:** Draws elliptical and propagated paths using Cesium's Entity API. Coordinates are populated as series of Cartesian3 points calculated from ECI vectors.
*   **Active Satellite Point Mapping:** Renders satellites as active points or 3D models moving in real-time based on coordinate time-deltas.
*   **Conjunction Hazard Spheres:** Draws red bounding spheres at coordinates of closest approaches (TCA), indicating the scale of collision threat zones (HBR).

---

## 🗺️ 4. Leaflet 2D Geographic Maps (Decay Corridors)

To plot where satellites reentering Earth's atmosphere will impact:
*   **Leaflet Map Widgets:** Renders flat 2D maps using OpenStreetMap tiles.
*   **GeoJSON Integration:** Accepts GeoJSON spatial data structures (returned from Monte Carlo simulation endpoints) representing the landing footprint polygon.
*   **Footprint Overlay Rendering:** Projects the landing envelope boundaries onto the map surface as a semi-transparent red alert zone.

---

## 🎨 5. HTML5 Canvas Coordinate Drawing (Cislunar CR3BP Engine)

CesiumJS is optimized for Earth orbits, but cislunar/Lagrange point trajectories operate in a deep space barycentric rotating coordinate system.
*   **HTML5 Canvas API:** Used to render cislunar systems (Earth, Moon, and the spacecraft trajectory) on a customized 2D grid.
*   **Coordinate Scaling:** Scales massive Astronomical Unit (AU) distances or Barycentric vectors into local canvas pixel layouts ($X, Y$).
*   **Animation Loop:** Draws rotating barycentric gravity coordinates and the spacecraft's orbital path (like TLI or Halo orbit sweeps) frame-by-frame.

---

## 🔌 6. WebSocket Client State Synchronization

To handle live alerts and telemetry streams:
*   **WebSocket Client connection:** Establishes a persistent connection to the FastAPI server (`ws://...`).
*   **State Appending:** Listens for telemetry objects (e.g., NOAA solar storms, real-time close approaches) and appends them to React state variables, updating tables and charts instantly without reloading.

---

## 📝 7. Maneuver Form Handlers & Proposals

*   **Coordinate Inputs:** Exposes interactive input forms for operators to key in radial, in-track, and cross-track delta-V burn parameters.
*   **State Negotiation Portal:** Renders two-operator workflow states (Proposed, Accept, Counter-Proposal), updating colors and action buttons dynamically based on operator inputs.
