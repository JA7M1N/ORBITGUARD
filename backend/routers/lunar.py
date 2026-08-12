import math
import heapq
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

def get_cost(x: float, y: float) -> float:
    """
    Computes traversal cost. Returns infinity if within crater core,
    or scaled cost if close to crater rim (steep slope hazard).
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
            # Inside crater core (impassable/dangerous - high penalty)
            max_penalty = max(max_penalty, 20.0)
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
            
            cost = get_cost(nx, ny)
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
        cost = get_cost(xy[0], xy[1])
        
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
