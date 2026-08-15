# Walkthrough - Collapsible Left Sidebar & Floating Map Controller Overlay

This walkthrough documents the implementation of a modern, collapsible navigation sidebar on the left side of the dashboard, alongside converting the map controller panel into a floating, collapsible overlay on top of the 3D globe visualization.

## Changes Made

### 1. Collapsible Sidebar Component ([`Sidebar.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/Sidebar.tsx))
- Added local state `isCollapsed` initialized from `localStorage` to persist across reloads.
- Created a top header flex container in the sidebar containing a toggle button utilizing `ChevronLeft`/`ChevronRight` icons.
- Applied responsive Tailwind CSS transitions for smooth expanding/collapsing (`md:w-64` vs `md:w-20` in `transition-all duration-300 ease-in-out`).
- Centered elements and removed texts/labels when collapsed, replacing them with native `title` HTML attributes for interactive hover tooltips.
- Converted the detailed system status footer panel into a compact vertical column of telemetry pulse dots when collapsed.

### 2. Floating Map Controller & Left-Side Information Stack ([`OrbitGlobe.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/OrbitGlobe.tsx))
- Stacked **Search & Filters** and **Map Controls** on the right side of the screen (`absolute top-6 right-6 z-10`).
- Moved **Active Trajectories**, **Satellite Info** (Registry/Launch/Keplerian elements), and **Telemetry HUD** (dynamic altitude, speed, coordinates, and burn simulation controls) to stack vertically on the top left of the screen (`absolute top-6 left-6 z-10`).
- Configured the left-side overlays with left-aligned flex items (`items-start`) and smooth transitions originating from the top-left (`origin-top-left`).
- Unified the Visibility Layers panel to display Payloads, Debris, and Sensors toggles in a modern 3-column layout.

### 3. Compilation Fix ([`LunarGlobe.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/LunarGlobe.tsx))
- Removed the invalid `imageryProvider={false}` prop from the `<Viewer>` element in `LunarGlobe.tsx`, resolving a TypeScript compilation block.

### 4. Self-Healing Database Epoch Check ([`main.py`](file:///c:/Users/jaymi/Documents/OrbitGuard/backend/main.py))
- Implemented a dynamic startup check in the FastAPI application lifespan. It checks if the latest state vector in the database is in the past compared to the current UTC time.
- If the database contains outdated orbit trajectories (which causes satellites to disappear on the globe due to time mismatch), it automatically clears the tables and re-seeds fresh, real-time SGP4 propagated state vectors starting exactly from `now()`.

### 5. Header Telemetry Bar & Dynamic Clock ([`Topbar.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/Topbar.tsx) & [`App.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/App.tsx))
- Restructured the top bar layout: moved the dynamic UTC clock to the left, rendering it directly adjacent to the brand logo as a sleek `LIVE • HH:MM:SS UTC` digital readout.
- Configured [`App.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/App.tsx) to fetch space weather metrics (`ap`, `f10_7`, `drag_scaler`) on mount and pass them down as props to the header.
- Designed a custom telemetry panel in the top-right of [`Topbar.tsx`](file:///c:/Users/jaymi/Documents/OrbitGuard/orbitguard-frontend/src/components/Topbar.tsx) displaying Space Weather parameters (`F10.7`, `Kp` calculated via logarithmic physics mapping, and `DRAG` multipliers) alongside a `TRACKED` satellite catalog capacity badge.
- Bound the telemetry parameters to the "Sim Storm" toggle so values update dynamically when simulation states shift (e.g. Ap jumps to `54.2`, Kp increases to `6.0`, and drag multiplier scales up).

## Verification & Build Results

### Automated Verification
- Ran the production bundle compilation command:
  ```bash
  npm run build
  ```
- **Result:** Successfully compiled with exit code `0`.
  ```text
  vite v8.2.1 building client environment for production...
  transforming...✓ 2478 modules transformed.
  rendering chunks...
  ✓ built in 2.67s
  ```

### Manual Verification Instructions
1. Open http://localhost:5173/ in your browser.
2. Inspect the top bar header:
   - On the left, verify the green pulsing `LIVE` badge and the running digital clock (`HH:MM:SS UTC`).
   - On the right, verify the `SPACE WX` box displaying live indices (e.g. `F10.7 136`, `Kp 2.1`, `DRAG 1.9x`) and the `TRACKED: 104` badge.
3. Click the **Sim Storm** button:
   - Verify that the space weather numbers update instantly (e.g., Kp index spikes to `6.0` and drag scales to `3.1x`).
4. Click on any satellite on the globe:
   - Verify that the **Satellite Info** panel and **Telemetry HUD** appear stacked on the right side under the controls.
5. Click the minimize/collapse buttons on all stacked overlays (stacked on the top-right overlay of the globe canvas):
   - Verify that they expand and collapse independently, and slide up/down cleanly to adjust their stacked offsets dynamically.
6. Verify that the selected trajectory list appears in the top-left corner without overlapping the controller panels.

---

## 🔬 Verification Results:
* **Backend API Check:** Querying `/api/satellites/25544/details` returned status `200 OK` with the exact parsed orbital elements and two active threat records.
* **Frontend Compilation Check:** Running `npm run build` compiled Vite packages successfully with `code 0` (zero compilation warnings/errors).
