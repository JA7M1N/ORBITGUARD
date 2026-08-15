import math
import heapq
import asyncio
from typing import List, Dict, Tuple
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/lunar", tags=["lunar"])

# Major Lunar South Pole Craters (Centered in latitude/longitude)
# Coordinates in degrees (Latitude, Longitude), Radii in km
CRATERS = [
    {"name": "Shackleton", "lat": -89.9, "lon": 0.0, "radius": 10.5},
    {"name": "Shoemaker", "lat": -88.1, "lon": 44.9, "radius": 25.0},
    {"name": "Faustini", "lat": -87.3, "lon": 77.0, "radius": 19.5},
    {"name": "de Gerlache", "lat": -88.5, "lon": -87.1, "radius": 16.0},
    {"name": "Haworth", "lat": -87.4, "lon": -5.1, "radius": 26.0},
    {"name": "Nobile", "lat": -85.3, "lon": 53.1, "radius": 36.5},
    {"name": "Amundsen", "lat": -84.3, "lon": 83.0, "radius": 52.5}
]

# Preset Mission Routes
MISSIONS = {
    "site_alpha_to_shackleton": {
        "name": "Mission 1: Landing Site Alpha to Shackleton Rim",
        "start": {"lat": -87.0, "lon": 10.0},
        "end": {"lat": -89.8, "lon": 5.0}
    },
    "site_beta_to_faustini": {
        "name": "Mission 2: Landing Site Beta to Faustini Base",
        "start": {"lat": -86.5, "lon": 65.0},
        "end": {"lat": -87.2, "lon": 76.5}
    },
    "polar_survey": {
        "name": "Mission 3: Polar Ridge Survey Traversal",
        "start": {"lat": -86.2, "lon": -40.0},
        "end": {"lat": -88.2, "lon": -60.0}
    }
}

class PathfindPayload(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float

# Stereographic Polar Projection helpers
# Maps south polar region (lat, lon) to Cartesian (x, y) with South Pole at (0,0)
# Latitude is between -90 and -80.
# 1 degree of latitude is roughly 30.32 km on the Moon.
DEG_TO_KM = 30.32

def to_cartesian(lat: float, lon: float) -> Tuple[float, float]:
    # Distance from South Pole in degrees
    r = lat + 90.0
    lon_rad = math.radians(lon)
    x = r * math.cos(lon_rad)
    y = r * math.sin(lon_rad)
    return x, y

def to_polar(x: float, y: float) -> Tuple[float, float]:
    r = math.sqrt(x*x + y*y)
    lat = r - 90.0
    lon_rad = math.atan2(y, x)
    lon = math.degrees(lon_rad)
    # Normalize longitude to [-180, 180]
    lon = (lon + 180) % 360 - 180
    return lat, lon

def get_cost(x: float, y: float, start_xy: Tuple[float, float] = None, end_xy: Tuple[float, float] = None) -> float:
    """
    Computes traversal cost. Returns infinity if within crater core,
    unless it is very close to start or end waypoints (to allow reaching targets).
    """
    lat, lon = to_polar(x, y)
    
    max_penalty = 1.0
    for crater in CRATERS:
        # Distance to crater center in km
        # Haversine-like distance in polar stereographic projection
        cx, cy = to_cartesian(crater["lat"], crater["lon"])
        dist_grid = math.sqrt((x - cx)**2 + (y - cy)**2)
        dist_km = dist_grid * DEG_TO_KM
        
        c_rad = crater["radius"]
        if dist_km <= c_rad:
            # Inside crater core (impassable/dangerous)
            # If coordinates are close (within 5.0 km) to start or end, allow traversal with high penalty (20.0).
            # Otherwise, treat as mathematically impassable.
            is_near_endpoint = False
            if start_xy:
                dist_start = math.sqrt((x - start_xy[0])**2 + (y - start_xy[1])**2) * DEG_TO_KM
                if dist_start < 5.0:
                    is_near_endpoint = True
            if end_xy:
                dist_end = math.sqrt((x - end_xy[0])**2 + (y - end_xy[1])**2) * DEG_TO_KM
                if dist_end < 5.0:
                    is_near_endpoint = True
                    
            if is_near_endpoint:
                max_penalty = max(max_penalty, 20.0)
            else:
                return float('inf')
        elif dist_km < c_rad * 1.3:
            # Steep slope near crater rim (traversal hazard)
            ratio = (dist_km - c_rad) / (c_rad * 0.3) # 0 to 1
            slope_cost = 1.0 + 15.0 * (1.0 - ratio)
            max_penalty = max(max_penalty, slope_cost)
            
    return max_penalty

def a_star_search(start_xy: Tuple[float, float], end_xy: Tuple[float, float]) -> List[Tuple[float, float]]:
    """
    Standard A* algorithm on stereographic grid.
    Grid spacing is 0.08 units (approx 2.4 km per step).
    """
    step = 0.08
    
    # Priority queue: (f_score, x, y, path)
    # We round coordinates to grid points to avoid infinite state space
    def round_to_grid(val: float) -> float:
        return round(val / step) * step

    start_x, start_y = round_to_grid(start_xy[0]), round_to_grid(start_xy[1])
    end_x, end_y = round_to_grid(end_xy[0]), round_to_grid(end_xy[1])
    
    g_score = {(start_x, start_y): 0.0}
    
    # Heap stores: (f, g, x, y, parent_coords)
    open_set = []
    heapq.heappush(open_set, (0.0, 0.0, start_x, start_y))
    
    came_from = {}
    
    directions = [
        (step, 0.0), (-step, 0.0), (0.0, step), (0.0, -step),
        (step, step), (step, -step), (-step, step), (-step, -step)
    ]
    
    # Cap iterations to prevent timeouts
    max_iterations = 8000
    iterations = 0
    
    found = False
    while open_set and iterations < max_iterations:
        iterations += 1
        f, g, cx, cy = heapq.heappop(open_set)
        
        # Check if we reached destination (within threshold)
        dist_to_end = math.sqrt((cx - end_x)**2 + (cy - end_y)**2)
        if dist_to_end < step * 1.5:
            end_x, end_y = cx, cy # Snap to final path
            found = True
            break
            
        for dx, dy in directions:
            nx, ny = round_to_grid(cx + dx), round_to_grid(cy + dy)
            
            cost = get_cost(nx, ny, start_xy, end_xy)
            if cost == float('inf'):
                continue
                
            # Movement distance cost (diagonals are slightly longer)
            move_dist = math.sqrt(dx*dx + dy*dy) * DEG_TO_KM
            tentative_g = g + move_dist * cost
            
            if (nx, ny) not in g_score or tentative_g < g_score[(nx, ny)]:
                g_score[(nx, ny)] = tentative_g
                came_from[(nx, ny)] = (cx, cy)
                
                # Heuristic: straight-line distance to goal in km
                h = math.sqrt((nx - end_x)**2 + (ny - end_y)**2) * DEG_TO_KM
                f_score = tentative_g + h
                
                heapq.heappush(open_set, (f_score, tentative_g, nx, ny))
                
    if not found:
        return []
        
    # Reconstruct path
    path = []
    curr = (end_x, end_y)
    while curr in came_from:
        path.append(curr)
        curr = came_from[curr]
    path.append((start_x, start_y))
    path.reverse()
    return path

@router.get("/hazards")
async def get_lunar_hazards():
    return {"craters": CRATERS, "missions": MISSIONS}

@router.post("/pathfind")
async def post_lunar_pathfind(payload: PathfindPayload):
    start_xy = to_cartesian(payload.start_lat, payload.start_lon)
    end_xy = to_cartesian(payload.end_lat, payload.end_lon)
    
    # Run pathfinder
    xy_waypoints = a_star_search(start_xy, end_xy)
    if not xy_waypoints:
        # Fallback to straight line if pathfinder is stuck
        xy_waypoints = [start_xy, end_xy]
        
    # Convert waypoints back to lat/lon coordinates
    waypoints = []
    total_length_km = 0.0
    prev_xy = None
    
    max_slope_gradient = 0.0
    
    for xy in xy_waypoints:
        lat, lon = to_polar(xy[0], xy[1])
        cost = get_cost(xy[0], xy[1], start_xy, end_xy)
        
        # Calculate slope gradient approximation
        # cost = 1.0 + 15 * (1.0 - ratio) -> max is 16.0
        # Convert cost index to approximate slope gradient in degrees (up to 30 degrees)
        if cost == float('inf'):
            slope = 90.0  # Vertical cliff/crater rim
        else:
            slope = (cost - 1.0) * 2.0  # 0 to 30 degrees slope
            
        if slope > max_slope_gradient:
            max_slope_gradient = slope
            
        waypoints.append({
            "lat": lat,
            "lon": lon,
            "slope": round(slope, 1)
        })
        
        if prev_xy:
            dist = math.sqrt((xy[0] - prev_xy[0])**2 + (xy[1] - prev_xy[1])**2) * DEG_TO_KM
            total_length_km += dist
        prev_xy = xy
        
    # Round metrics for display
    return {
        "status": "success",
        "waypoints": waypoints,
        "metrics": {
            "total_distance_km": round(total_length_km, 2),
            "max_slope_gradient_pct": round(max_slope_gradient, 1),
            "safety_margin_pct": round(max(0.0, 100.0 - max_slope_gradient * 3.0), 1)
        }
    }


# Earth-Moon gravity parameters (ECI Barycentric Frame Constants)
MU_E = 398600.4418  # Earth gravity constant (km^3/s^2)
MU_M = 4902.8000    # Moon gravity constant (km^3/s^2)
D_EM = 384400.0     # Mean Earth-Moon Distance (km)
T_MOON = 27.32166 * 86400.0  # Moon orbit period (seconds)
OMEGA_MOON = (2.0 * math.pi) / T_MOON  # Moon mean motion (rad/s)


class CislunarPropagateRequest(BaseModel):
    x: float
    y: float
    z: float
    vx: float
    vy: float
    vz: float
    duration_days: float


def derivatives(t: float, y: List[float]) -> List[float]:
    x, y_coord, z, vx, vy, vz = y
    
    # Moon position relative to Earth at time t
    theta = OMEGA_MOON * t
    mx = D_EM * math.cos(theta)
    my = D_EM * math.sin(theta)
    mz = 0.0
    
    # Distance magnitudes
    dist_e = math.sqrt(x*x + y_coord*y_coord + z*z)
    dist_m = math.sqrt((x - mx)**2 + (y_coord - my)**2 + (z - mz)**2)
    
    # Singularity threshold avoidance
    eps = 1e-5
    
    # Gravitational pulls
    ax_e = -MU_E * x / (dist_e**3 + eps)
    ay_e = -MU_E * y_coord / (dist_e**3 + eps)
    az_e = -MU_E * z / (dist_e**3 + eps)
    
    ax_m = -MU_M * (x - mx) / (dist_m**3 + eps)
    ay_m = -MU_M * (y_coord - my) / (dist_m**3 + eps)
    az_m = -MU_M * (z - mz) / (dist_m**3 + eps)
    
    return [
        vx, vy, vz,
        ax_e + ax_m,
        ay_e + ay_m,
        az_e + az_m
    ]


def run_cislunar_propagation(payload: CislunarPropagateRequest):
    # Time step: 180 seconds (3 minutes) for stable RK4 integration
    dt = 180.0
    t_end = payload.duration_days * 86400.0
    
    y_curr = [payload.x, payload.y, payload.z, payload.vx, payload.vy, payload.vz]
    t = 0.0
    
    trajectory = []
    moon_trajectory = []
    
    # Record once every 10 steps to keep transfer packages lightweight
    record_every = 10
    step_count = 0
    
    min_dist_to_moon = float('inf')
    min_dist_to_earth = float('inf')
    
    while t < t_end:
        x, y, z, vx, vy, vz = y_curr
        r_sc = math.sqrt(x*x + y*y + z*z)
        
        # Moon current position vector
        theta = OMEGA_MOON * t
        mx = D_EM * math.cos(theta)
        my = D_EM * math.sin(theta)
        mz = 0.0
        
        dist_to_moon = math.sqrt((x - mx)**2 + (y - my)**2 + (z - mz)**2)
        if dist_to_moon < min_dist_to_moon:
            min_dist_to_moon = dist_to_moon
        if r_sc < min_dist_to_earth:
            min_dist_to_earth = r_sc
            
        if step_count % record_every == 0:
            trajectory.append({
                "x": round(x, 1),
                "y": round(y, 1),
                "z": round(z, 1)
            })
            moon_trajectory.append({
                "x": round(mx, 1),
                "y": round(my, 1),
                "z": round(mz, 1)
            })
            
        # Runge-Kutta 4th-Order Integration
        k1 = derivatives(t, y_curr)
        y2 = [y_curr[i] + k1[i] * dt / 2.0 for i in range(6)]
        k2 = derivatives(t + dt / 2.0, y2)
        y3 = [y_curr[i] + k2[i] * dt / 2.0 for i in range(6)]
        k3 = derivatives(t + dt / 2.0, y3)
        y4 = [y_curr[i] + k3[i] * dt for i in range(6)]
        k4 = derivatives(t + dt, y4)
        
        for i in range(6):
            y_curr[i] += (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]) * dt / 6.0
            
        t += dt
        step_count += 1
        
    # Append final coordinates
    x, y, z, _, _, _ = y_curr
    trajectory.append({"x": round(x, 1), "y": round(y, 1), "z": round(z, 1)})
    theta = OMEGA_MOON * t
    moon_trajectory.append({"x": round(D_EM * math.cos(theta), 1), "y": round(D_EM * math.sin(theta), 1), "z": 0.0})
    
    # Establish safety indicators
    status = "NOMINAL"
    warning_msg = None
    if min_dist_to_moon < 1737.4 + 200.0:  # Lunar surface impact threshold
        status = "CRITICAL HAZARD"
        warning_msg = f"Collision risk! Spacecraft trajectory breaches lunar exclusion boundary (min distance: {min_dist_to_moon:.1f} km)."
    elif min_dist_to_earth < 6378.137 + 100.0:  # Earth reentry threshold
        status = "CRITICAL HAZARD"
        warning_msg = f"Reentry trajectory! Spacecraft altitude drops below Earth atmospheric boundary (min distance: {min_dist_to_earth:.1f} km)."
    elif min_dist_to_moon < 10000.0:
        status = "WARNING"
        warning_msg = f"Lunar proximity warning: Trajectory intercepts lunar gravitational influence domain (min distance: {min_dist_to_moon:.1f} km)."
        
    # Compute approximation of energy barycentric state
    v_sq = payload.vx**2 + payload.vy**2 + payload.vz**2
    r1 = math.sqrt(payload.x**2 + payload.y**2 + payload.z**2)
    r2 = math.sqrt((payload.x - D_EM)**2 + payload.y**2 + payload.z**2)
    energy = 0.5 * v_sq - MU_E / r1 - MU_M / r2
    
    return {
        "status": "success",
        "trajectory": trajectory,
        "moon_trajectory": moon_trajectory,
        "metrics": {
            "minimum_moon_distance_km": round(min_dist_to_moon, 1),
            "minimum_earth_distance_km": round(min_dist_to_earth, 1),
            "energy_state_jacobi": round(energy, 4),
            "safety_status": status,
            "warning_message": warning_msg
        }
    }

@router.post("/propagate")
async def post_cislunar_propagate(payload: CislunarPropagateRequest):
    return await asyncio.to_thread(run_cislunar_propagation, payload)
