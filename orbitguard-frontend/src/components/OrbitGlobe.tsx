import React, { useRef, useState, useEffect } from 'react';
import { Viewer, CzmlDataSource, Entity, PolylineGraphics } from 'resium';
import * as Cesium from 'cesium';
import axios from 'axios';
import { Crosshair, Shield, X, EyeOff, Info, AlertTriangle, Search, Minimize2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface OrbitGlobeProps {
  limit?: number;
  showDebris: boolean;
  showPayloads: boolean;
  showSensors: boolean;
  showHeatmap: boolean;
  isSimActive?: boolean;
  multiplier: number;
}

export const OrbitGlobe: React.FC<OrbitGlobeProps> = ({
  limit = 40,
  showDebris,
  showPayloads,
  showSensors,
  showHeatmap,
  isSimActive = false,
  multiplier
}) => {
  const viewerRef = useRef<any>(null);
  const [czmlData, setCzmlData] = useState<any[]>([]);
  const [selectedSat, setSelectedSat] = useState<any>(null);
  const [selectedSatIds, setSelectedSatIds] = useState<Set<string>>(new Set());
  const [hoveredSatId, setHoveredSatId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<{
    name: string;
    noradId: string;
    altitude: number; // km
    velocity: number; // km/s
    type: string;
    operator: string;
    latitude: number;
    longitude: number;
    dragStatus?: string;
    decayRate?: number;
    dragScale?: number;
  } | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [solarWeather, setSolarWeather] = useState<{ f10_7: number; ap: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [operatorFilter, setOperatorFilter] = useState<string>("ALL");
  const [maneuverDeltaV, setManeuverDeltaV] = useState<number>(0);
  const [satDetails, setSatDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [isSearchCollapsed, setIsSearchCollapsed] = useState<boolean>(false);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState<boolean>(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);

  const hoveredSatIdRef = useRef<string | null>(null);
  const selectedSatRef = useRef<any>(null);
  const selectedSatIdsRef = useRef<Set<string>>(new Set());

  // Sync refs with React state to support non-closure access inside Cesium CallbackProperty instances
  useEffect(() => { hoveredSatIdRef.current = hoveredSatId; }, [hoveredSatId]);
  useEffect(() => { selectedSatRef.current = selectedSat; }, [selectedSat]);
  useEffect(() => { selectedSatIdsRef.current = selectedSatIds; }, [selectedSatIds]);

  // Fetch detailed satellite info when selectedSat changes
  useEffect(() => {
    if (!selectedSat) {
      setSatDetails(null);
      return;
    }
    const fetchDetails = async () => {
      setLoadingDetails(true);
      try {
        const noradId = selectedSat.id.replace("sat_", "");
        const response = await axios.get(`${API_BASE_URL}/api/satellites/${noradId}/details`);
        setSatDetails(response.data);
      } catch (err) {
        console.error("Error fetching satellite details:", err);
        setSatDetails(null);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedSat]);

  // Fetch live NOAA solar weather indices for orbit decay calculations
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/solar`);
        const data = response.data;
        // Support both nested current schema and flat schema
        const f10_7 = data.f10_7 || data.current?.f10_7 || 135.0;
        const ap = data.ap || data.current?.ap || 12.0;
        setSolarWeather({ f10_7, ap });
      } catch (e) {
        console.error("Error fetching solar weather in globe:", e);
        setSolarWeather({ f10_7: 135.0, ap: 12.0 });
      }
    };
    fetchWeather();
  }, []);

  // 1. Fetch CZML trajectories from FastAPI backend
  useEffect(() => {
    const fetchCzml = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/satellites/czml?limit=${limit}`);
        setCzmlData(response.data);
      } catch (e) {
        console.error("Error fetching CZML data source:", e);
      }
    };
    fetchCzml();
  }, [limit]);

  // Mouse move handler for hover state logic (decluttering labels and dots)
  useEffect(() => {
    if (!viewerRef.current || !viewerRef.current.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;
    
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      try {
        const pickedObject = viewer.scene.pick(movement.endPosition);
        if (
          Cesium.defined(pickedObject) && 
          pickedObject.id &&
          pickedObject.id instanceof Cesium.Entity && 
          typeof pickedObject.id.id === 'string' &&
          pickedObject.id.id.startsWith("sat_")
        ) {
          setHoveredSatId(pickedObject.id.id);
        } else {
          setHoveredSatId(null);
        }
      } catch (e) {
        console.error("Error in MOUSE_MOVE pick handler:", e);
        setHoveredSatId(null);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
    };
  }, [czmlData]);

  // 2. Sync clock multiplier speed with parent controls
  useEffect(() => {
    if (viewerRef.current && viewerRef.current.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      viewer.clock.multiplier = multiplier;
    }
  }, [multiplier]);

  // 3. Render ground tracking sensor stations
  useEffect(() => {
    if (!viewerRef.current || !viewerRef.current.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;

    // Clear existing sensor entities
    viewer.entities.values
      .filter((e: any) => e.id && e.id.startsWith("sensor_"))
      .forEach((e: any) => viewer.entities.remove(e));

    if (showSensors) {
      // Ground stations mapping
      const groundStations = [
        { name: "Svalbard Satellite Station (Norway)", lat: 78.2297, lon: 15.4077 },
        { name: "ISRO Telemetry Station (Bengaluru)", lat: 13.0343, lon: 77.5116 },
        { name: "Goldstone Deep Space (California)", lat: 35.4267, lon: -116.8900 },
        { name: "Hartebeesthoek (South Africa)", lat: -25.8872, lon: 27.7078 }
      ];

      groundStations.forEach((station, idx) => {
        viewer.entities.add({
          id: `sensor_${idx}`,
          name: station.name,
          position: Cesium.Cartesian3.fromDegrees(station.lon, station.lat, 0),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString('#3b82f6'), // blue
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
          },
          // Sensor radar cone visualization
          ellipse: {
            semiMinorAxis: 800000.0, // 800 km coverage
            semiMajorAxis: 800000.0,
            material: Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.12),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.4),
            height: 0
          }
        });
      });
    }
  }, [showSensors, czmlData]);

  // Render 3D orbital hazard shells / heatmap layer
  useEffect(() => {
    if (!viewerRef.current || !viewerRef.current.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;

    // Remove existing hazard entities
    viewer.entities.values
      .filter((e: any) => e.id && e.id.startsWith("hazard_"))
      .forEach((e: any) => viewer.entities.remove(e));

    if (showHeatmap) {
      const earthRadius = 6378137.0;

      // 1. High-Density Polar Debris Shell (Hollow sphere 700km to 900km)
      viewer.entities.add({
        id: "hazard_debris_shell",
        name: "LEO Polar Debris Shell (700-900 km altitude)",
        position: Cesium.Cartesian3.ZERO,
        ellipsoid: {
          radii: new Cesium.Cartesian3(earthRadius + 900000.0, earthRadius + 900000.0, earthRadius + 900000.0),
          innerRadii: new Cesium.Cartesian3(earthRadius + 700000.0, earthRadius + 700000.0, earthRadius + 700000.0),
          material: Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.06),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.2),
          slicePartitions: 24,
          stackPartitions: 24
        }
      });

      // 2. High-Density Mega-Constellation Payload Shell (Hollow sphere 350km to 550km)
      viewer.entities.add({
        id: "hazard_constellation_shell",
        name: "LEO Constellation Payload Shell (350-550 km altitude)",
        position: Cesium.Cartesian3.ZERO,
        ellipsoid: {
          radii: new Cesium.Cartesian3(earthRadius + 550000.0, earthRadius + 550000.0, earthRadius + 550000.0),
          innerRadii: new Cesium.Cartesian3(earthRadius + 350000.0, earthRadius + 350000.0, earthRadius + 350000.0),
          material: Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.04),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.15),
          slicePartitions: 24,
          stackPartitions: 24
        }
      });
    }
  }, [showHeatmap, czmlData]);

  // 4. Update real-time physics telemetry and dynamic camera locking for selected satellite
  useEffect(() => {
    if (!selectedSat || !viewerRef.current || !viewerRef.current.cesiumElement) {
      setTelemetry(null);
      return;
    }

    const viewer = viewerRef.current.cesiumElement;
    
    const updateTelemetry = () => {
      const time = viewer.clock.currentTime;
      
      // Get position in Cartesian3 meters
      const position = selectedSat.position.getValue(time);
      if (!position) return;

      // Distance from Earth center in meters
      const distance = Cesium.Cartesian3.magnitude(position);
      // Average Earth radius = 6378137.0 m
      const altitude = Math.max(0, (distance - 6378137.0) / 1000.0);

      // Convert Cartesian3 to Cartographic (Geodetic) coordinates
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const latitude = cartographic ? Cesium.Math.toDegrees(cartographic.latitude) : 0;
      const longitude = cartographic ? Cesium.Math.toDegrees(cartographic.longitude) : 0;

      // Velocity calculation via position delta over 0.1 second
      const nextTime = Cesium.JulianDate.addSeconds(time, 0.1, new Cesium.JulianDate());
      const nextPosition = selectedSat.position.getValue(nextTime);
      
      let velocity = 7.5; // default fallback LEO velocity in km/s
      let vVec = new Cesium.Cartesian3(0.0, 7500.0, 0.0); // default velocity vector
      if (nextPosition) {
        vVec = Cesium.Cartesian3.subtract(nextPosition, position, new Cesium.Cartesian3());
        Cesium.Cartesian3.multiplyByScalar(vVec, 10.0, vVec); // velocity in m/s
        velocity = Cesium.Cartesian3.magnitude(vVec) / 1000.0;
      }

      // Calculate atmospheric drag and orbit decay using exponential scale height and live solar weather indices
      let dragStatus = "Nominal";
      let decayRate = 0.0;
      let dragScale = 1.0;

      if ((solarWeather || isSimActive) && altitude < 1200.0) {
        let baseDensity = 0.0;
        if (altitude < 300) {
          baseDensity = 1.5e-11 * Math.exp(-(altitude - 200) / 40.0);
        } else if (altitude < 500) {
          baseDensity = 1.0e-12 * Math.exp(-(altitude - 300) / 60.0);
        } else if (altitude < 800) {
          baseDensity = 1.0e-14 * Math.exp(-(altitude - 500) / 90.0);
        } else {
          baseDensity = 1.0e-15 * Math.exp(-(altitude - 800) / 120.0);
        }

        // Standard quiet conditions are f10_7 = 70.0, ap = 7.0. Override if presentation storm is simulated.
        const f10 = isSimActive ? 220.0 : (solarWeather?.f10_7 || 135.0);
        const apVal = isSimActive ? 54.2 : (solarWeather?.ap || 12.0);

        dragScale = 1.0 + Math.max(0, (f10 - 70.0) / 80.0) + Math.max(0, (apVal - 7.0) / 15.0);
        decayRate = baseDensity * dragScale * 1.5e14;

        if (decayRate > 40.0) {
          dragStatus = "Critical";
        } else if (decayRate > 10.0) {
          dragStatus = "Elevated";
        } else if (decayRate > 1.0) {
          dragStatus = "Moderate";
        } else if (decayRate > 0.01) {
          dragStatus = "Nominal";
        } else {
          dragStatus = "Negligible";
        }
      } else if (altitude >= 1200.0) {
        dragStatus = "Negligible";
        decayRate = 0.0;
        dragScale = 1.0;
      }

      // Parse metadata from description
      const desc = selectedSat.description?.getValue(time) || "";
      const noradMatch = desc.match(/NORAD ID:\s*(\d+)/);
      const typeMatch = desc.match(/Type:\s*([^\s|]+)/);
      const operatorMatch = desc.match(/Operator:\s*([^|]+)/);
      
      setTelemetry({
        name: selectedSat.name || "Unknown Object",
        noradId: noradMatch ? noradMatch[1] : "N/A",
        altitude: altitude,
        velocity: velocity,
        type: typeMatch ? typeMatch[1] : "Payload",
        operator: operatorMatch ? operatorMatch[1].trim() : "Unknown",
        latitude: latitude,
        longitude: longitude,
        dragStatus: dragStatus,
        decayRate: decayRate,
        dragScale: dragScale
      });

      // DYNAMIC CO-ORBITING CAMERA LOCK:
      // Positions the camera at a fixed offset in the satellite's local orbital frame (VVLH).
      // This keeps the camera flying in parallel at the exact same speed as the satellite.
      if (isTracking) {
        // Radial unit vector (Up)
        const rUnit = Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3());
        // Normal unit vector (cross product of position and velocity)
        const h = Cesium.Cartesian3.cross(position, vVec, new Cesium.Cartesian3());
        const hUnit = Cesium.Cartesian3.normalize(h, new Cesium.Cartesian3());
        // In-track unit vector (Velocity direction along orbit)
        const tUnit = Cesium.Cartesian3.cross(hUnit, rUnit, new Cesium.Cartesian3());

        // Camera Offset in Local Orbital Frame:
        // 250 km behind the satellite, 120 km to the side, 80 km above
        const offsetBehind = -250000.0;
        const offsetSide = 120000.0;
        const offsetAbove = 80000.0;

        const camPos = new Cesium.Cartesian3();
        Cesium.Cartesian3.add(position, Cesium.Cartesian3.multiplyByScalar(tUnit, offsetBehind, new Cesium.Cartesian3()), camPos);
        Cesium.Cartesian3.add(camPos, Cesium.Cartesian3.multiplyByScalar(hUnit, offsetSide, new Cesium.Cartesian3()), camPos);
        Cesium.Cartesian3.add(camPos, Cesium.Cartesian3.multiplyByScalar(rUnit, offsetAbove, new Cesium.Cartesian3()), camPos);

        viewer.camera.setView({
          destination: camPos,
          orientation: {
            direction: Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(position, camPos, new Cesium.Cartesian3()), new Cesium.Cartesian3()),
            up: rUnit
          }
        });
      }
    };

    updateTelemetry();
    
    // Listen to tick events to calculate metrics and update camera position in real-time
    const removeListener = viewer.clock.onTick.addEventListener(updateTelemetry);
    return () => removeListener();
  }, [selectedSat, isTracking, solarWeather, isSimActive]);

  // 5. Handle selection updates
  const handleSelectedEntityChange = (entity: any) => {
    setManeuverDeltaV(0);
    if (entity && entity.id && entity.id.startsWith("sat_")) {
      setSelectedSat(entity);
      setIsInfoCollapsed(false);
      setIsHudCollapsed(false);
    } else {
      setSelectedSat(null);
      setIsTracking(false);
    }
  };

  // Lock camera target onto clicked satellite
  const handleTrackEntity = () => {
    if (selectedSat) {
      setIsTracking(true);
    }
  };

  // Free camera from tracking selected satellite
  const handleUntrackEntity = () => {
    setIsTracking(false);
    setManeuverDeltaV(0);
    if (viewerRef.current && viewerRef.current.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      // Fly camera back to a nice overview of the Earth
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(0.0, 20.0, 20000000.0), // center latitude/longitude/altitude (20,000 km up)
        duration: 1.5
      });
    }
  };

  // Keyboard shortcut: Escape key resets view, tracking, and selections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTracking(false);
        setManeuverDeltaV(0);
        if (viewerRef.current && viewerRef.current.cesiumElement) {
          const viewer = viewerRef.current.cesiumElement;
          viewer.selectedEntity = undefined;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(0.0, 20.0, 20000000.0),
            duration: 1.5
          });
        }
        setSelectedSat(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelectSearchResult = (satEntityId: string) => {
    if (viewerRef.current && viewerRef.current.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      
      let entity = null;
      const dsLength = viewer.dataSources.length;
      for (let i = 0; i < dsLength; i++) {
        const ds = viewer.dataSources.get(i);
        const match = ds.entities.values.find((e: any) => e.id === satEntityId);
        if (match) {
          entity = match;
          break;
        }
      }

      if (entity) {
        setSelectedSat(entity);
        viewer.selectedEntity = entity;
        
        const time = viewer.clock.currentTime;
        const position = entity.position.getValue(time);
        if (position) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.add(
              position,
              new Cesium.Cartesian3(600000.0, 600000.0, 400000.0),
              new Cesium.Cartesian3()
            ),
            duration: 1.5
          });
        }
      }
    }
    setSearchQuery("");
  };

  const filteredCzml = czmlData.filter((packet: any) => {
    if (packet.id === "document") return true;
    const descLower = (packet.description || "").toLowerCase();
    
    // 1. Layer Visibility Check
    const isDebris = descLower.includes("debris");
    if (isDebris && !showDebris) return false;
    const isPayload = descLower.includes("payload");
    if (isPayload && !showPayloads) return false;

    // 2. Search Query Filter (Matches Name or NORAD ID)
    const nameLower = (packet.name || "").toLowerCase();
    const noradId = packet.id.replace("sat_", "");
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const matchesName = nameLower.includes(q);
      const matchesId = noradId.includes(q);
      if (!matchesName && !matchesId) return false;
    }

    // 3. Operator Filter Check
    if (operatorFilter !== "ALL") {
      const opMatch = packet.description?.match(/Operator:\s*([^|]+)/);
      const operator = opMatch ? opMatch[1].trim().toUpperCase() : "";
      const targetOp = operatorFilter.toUpperCase();

      if (targetOp === "SPACEX" && !operator.includes("SPACEX") && !operator.includes("STARLINK")) return false;
      if (targetOp === "ISRO" && !operator.includes("ISRO") && !operator.includes("INDIA")) return false;
      if (targetOp === "NASA" && !operator.includes("NASA") && !operator.includes("USA")) return false;
      if (targetOp === "ESA" && !operator.includes("ESA") && !operator.includes("EUROPE")) return false;
      if (targetOp === "ROSCOSMOS" && !operator.includes("ROSCOSMOS") && !operator.includes("RUSSIA")) return false;
    }
    
    return true;
  });

  // Render default states (dots & hidden labels/paths/billboards) directly from CZML
  const mappedCzml = filteredCzml;

  // Generate future perturbed trajectory positions for maneuver simulation
  const futurePositions: Cesium.Cartesian3[] = [];
  if (viewerRef.current && viewerRef.current.cesiumElement && selectedSat && maneuverDeltaV !== 0) {
    const viewer = viewerRef.current.cesiumElement;
    const currentTime = viewer.clock.currentTime;
    for (let i = 0; i <= 30; i++) {
      const offsetSeconds = i * 180;
      const evalTime = Cesium.JulianDate.addSeconds(currentTime, offsetSeconds, new Cesium.JulianDate());
      const pos = selectedSat.position.getValue(evalTime);
      if (pos) {
        const rUnit = Cesium.Cartesian3.normalize(pos, new Cesium.Cartesian3());
        // Perturbation distance scales with time to reflect orbital divergence
        const scale = maneuverDeltaV * (offsetSeconds / 10.0);
        const shiftVec = Cesium.Cartesian3.multiplyByScalar(rUnit, scale, new Cesium.Cartesian3());
        const perturbedPos = Cesium.Cartesian3.add(pos, shiftVec, new Cesium.Cartesian3());
        futurePositions.push(perturbedPos);
      }
    }
  }

  // Callback handler to inject dynamic hover & selection properties on entity load
  const handleCzmlLoad = (dataSource: any) => {
    dataSource.entities.values.forEach((entity: any) => {
      if (!entity.id || !entity.id.startsWith("sat_")) return;
      const entityId = entity.id;
      const noradId = entityId.replace("sat_", "");

      // Retrieve type value from custom properties dictionary
      const properties = entity.properties;
      const typeValue = properties && properties.type ? properties.type.getValue(Cesium.JulianDate.now()) : "";
      const typeStr = (typeValue || "").toString().toLowerCase();
      const isDebris = typeStr.includes("debris");
      const isRocket = typeStr.includes("rocket");

      const checkSelected = () => {
        return selectedSatIdsRef.current.has(noradId) || 
               (selectedSatRef.current && selectedSatRef.current.id === entityId);
      };

      const checkHovered = () => {
        return hoveredSatIdRef.current === entityId;
      };

      // 1. Label show Callback (shows if hovered or selected)
      if (entity.label) {
        entity.label.show = new Cesium.CallbackProperty(() => checkHovered() || checkSelected(), false);
      }

      // 2. Point show Callback (always show the dot, even on hover/selection)
      if (entity.point) {
        entity.point.show = new Cesium.ConstantProperty(true);
      }

      // 3. Billboard show Callback (always hidden since we display 3D models when active)
      if (entity.billboard) {
        entity.billboard.show = new Cesium.ConstantProperty(false);
      }

      // 4. Model show & properties Callback (shows ONLY when selected/tracked)
      if (entity.model) {
        entity.model.show = new Cesium.CallbackProperty(() => checkSelected(), false);
        
        // Color tinting based on object type
        entity.model.color = new Cesium.CallbackProperty(() => {
          if (isDebris) return Cesium.Color.RED;
          if (isRocket) return Cesium.Color.ORANGE;
          return Cesium.Color.WHITE;
        }, false);
        entity.model.colorBlendMode = new Cesium.ConstantProperty(Cesium.ColorBlendMode.HIGHLIGHT);
        entity.model.colorBlendAmount = new Cesium.ConstantProperty(0.7);

        // Scaling parameters for clean visibility (increased to 160px for tracking)
        entity.model.minimumPixelSize = new Cesium.ConstantProperty(160);
        entity.model.maximumScale = new Cesium.ConstantProperty(6000);
      }

      // 4. Path show Callback (show path only when selected or pinned)
      if (entity.path) {
        entity.path.show = new Cesium.CallbackProperty(() => {
          return selectedSatIdsRef.current.has(noradId) || 
                 (selectedSatRef.current && selectedSatRef.current.id === entityId);
        }, false);
      }
    });
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl">
      {/* 3D Earth Viewer Canvas */}
      <Viewer
        ref={viewerRef}
        full
        shouldAnimate={true}
        timeline={false}
        animation={false}
        navigationHelpButton={false}
        geocoder={false}
        homeButton={false}
        sceneModePicker={false}
        baseLayerPicker={false}
        infoBox={false}
        selectionIndicator={true}
        onSelectedEntityChange={handleSelectedEntityChange}
        style={{ width: '100%', height: '100%' }}
      >
        {mappedCzml.length > 0 && (
          <CzmlDataSource data={mappedCzml} onLoad={handleCzmlLoad} />
        )}
        {maneuverDeltaV !== 0 && futurePositions.length > 0 && (
          <Entity id="maneuver_simulation_path">
            <PolylineGraphics
              positions={futurePositions}
              width={2.5}
              material={new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.fromCssColorString('#fbbf24'), // Amber
                dashLength: 12.0
              })}
            />
          </Entity>
        )}
      </Viewer>

      {/* Floating Map Search & Operator Filter Panel (Top-Right overlay) */}
      <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-2.5">
        {isSearchCollapsed ? (
          <button
            onClick={() => setIsSearchCollapsed(false)}
            className="glassmorphism p-3 rounded-xl border border-slate-700/50 hover:border-blue-500/55 hover:bg-slate-900/60 shadow-2xl text-blue-450 transition-all flex items-center gap-2 cursor-pointer"
            title="Expand Search & Filters"
          >
            <Search className="h-4.5 w-4.5" />
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider pr-1">Search & Filters</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2.5 w-80">
            <div className="glassmorphism rounded-2xl p-4 border border-slate-700/50 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                  Satellite Search & Filters
                </span>
                <button
                  onClick={() => setIsSearchCollapsed(true)}
                  className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors cursor-pointer"
                  title="Collapse Panel"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or NORAD ID..."
                  className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-350 placeholder-slate-650 focus:border-blue-500 focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2 text-[10px] font-mono text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Operator Filter Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                  Filter by Operator
                </label>
                <select
                  value={operatorFilter}
                  onChange={(e) => setOperatorFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-350 focus:border-blue-500 focus:outline-none transition-colors"
                >
                  <option value="ALL">All Operators</option>
                  <option value="ISRO">ISRO (India)</option>
                  <option value="SPACEX">SpaceX / Starlink (USA)</option>
                  <option value="NASA">NASA / USA Gov</option>
                  <option value="ESA">ESA (Europe)</option>
                  <option value="ROSCOSMOS">Roscosmos (Russia)</option>
                </select>
              </div>
            </div>

            {/* Dynamic Search Results Dropdown List */}
            {searchQuery.trim() !== "" && (
              <div className="glassmorphism rounded-2xl border border-slate-700/50 shadow-2xl p-3 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-800 pb-1.5 mb-1">
                  Search Results
                </div>
                {czmlData
                  .filter((p: any) => {
                    if (p.id === "document") return false;
                    const name = (p.name || "").toLowerCase();
                    const q = searchQuery.toLowerCase().trim();
                    const matchesName = name.includes(q);
                    const matchesId = p.id.replace("sat_", "").includes(q);
                    return matchesName || matchesId;
                  })
                  .slice(0, 5)
                  .map((p: any) => {
                    const noradId = p.id.replace("sat_", "");
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectSearchResult(p.id)}
                        className="w-full text-left bg-slate-950/30 border border-slate-900 hover:bg-slate-900/60 p-2 rounded-xl text-[10px] font-mono text-slate-300 hover:text-blue-400 flex justify-between items-center transition-colors"
                      >
                        <span className="truncate max-w-[170px] font-semibold">{p.name}</span>
                        <span className="text-[9px] text-slate-500">NORAD {noradId}</span>
                      </button>
                    );
                  })}
                {czmlData.filter((p: any) => {
                  if (p.id === "document") return false;
                  const name = (p.name || "").toLowerCase();
                  const q = searchQuery.toLowerCase().trim();
                  return name.includes(q) || p.id.replace("sat_", "").includes(q);
                }).length === 0 && (
                  <div className="text-[10px] font-mono text-slate-500 italic text-center py-2">
                    No matching satellites found.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Trajectories List (Top-Left of globe) */}
      {selectedSatIds.size > 0 && (
        <div className="absolute top-6 left-6 z-10 glassmorphism rounded-2xl p-4 w-72 border border-slate-700/50 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              Active Trajectories ({selectedSatIds.size})
            </span>
            <button
              onClick={() => setSelectedSatIds(new Set())}
              className="text-[9px] bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded font-mono transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
            {Array.from(selectedSatIds).map(id => {
              const satPacket = czmlData.find(p => p.id === `sat_${id}`);
              const satName = satPacket ? satPacket.name : `NORAD ${id}`;
              return (
                <div key={id} className="flex items-center justify-between bg-slate-900/30 border border-slate-900 px-2.5 py-1.5 rounded-lg text-[10px] font-mono">
                  <span className="text-slate-300 truncate max-w-[150px]">{satName}</span>
                  <button
                    onClick={() => {
                      setSelectedSatIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(id);
                        return newSet;
                      });
                      if (selectedSat && selectedSat.id === `sat_${id}`) {
                        setSelectedSat(null);
                      }
                    }}
                    className="text-slate-500 hover:text-red-400 font-bold ml-2"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Satellite Information Overlay (Left-Center Panel) */}
      {selectedSat && satDetails && (
        <div className="absolute top-[180px] left-6 z-10 flex flex-col items-start">
          {isInfoCollapsed ? (
            <button
              onClick={() => setIsInfoCollapsed(false)}
              className="glassmorphism p-3 rounded-xl border border-slate-700/50 hover:border-purple-500/55 hover:bg-slate-900/60 shadow-2xl text-purple-400 transition-all flex items-center gap-2 cursor-pointer"
              title="Expand Satellite Info"
            >
              <Info className="h-4 w-4" />
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider pr-1">Satellite Info</span>
            </button>
          ) : (
            <div className="glassmorphism rounded-2xl p-5 w-80 border border-slate-700/50 shadow-2xl transition-all duration-300 max-h-[calc(100vh-340px)] overflow-y-auto font-mono text-[11px]">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-purple-400" />
                  <h4 className="text-xs font-bold tracking-wider text-slate-100 uppercase truncate max-w-[150px]">
                    {satDetails.name} Info
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsInfoCollapsed(true)}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                    title="Collapse Panel"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    onClick={() => {
                      setSatDetails(null);
                      setSelectedSat(null);
                      setIsTracking(false);
                    }}
                    className="text-slate-500 hover:text-slate-350 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {loadingDetails ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 text-[10px]">
                  <span className="animate-pulse">PARSING ORBITAL DATA...</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Core Registry */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Registry & Launch</span>
                    <div className="flex justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-900/60">
                      <span className="text-slate-500">LAUNCH DESIGNATOR</span>
                      <span className="text-slate-300 font-bold">{satDetails.launch_designator}</span>
                    </div>
                    <div className="flex justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-900/60">
                      <span className="text-slate-500">LAUNCH YEAR</span>
                      <span className="text-slate-300 font-bold">{satDetails.launch_year}</span>
                    </div>
                  </div>

                  {/* Keplerian Elements */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Orbital Elements</span>
                    <div className="flex justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-900/60">
                      <span className="text-slate-500">INCLINATION</span>
                      <span className="text-slate-300 font-semibold">{satDetails.orbital_elements.inclination_deg.toFixed(4)}°</span>
                    </div>
                    <div className="flex justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-900/60">
                      <span className="text-slate-500">ECCENTRICITY</span>
                      <span className="text-slate-300 font-semibold">{satDetails.orbital_elements.eccentricity.toFixed(7)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-900/60">
                      <span className="text-slate-500">ORBITAL PERIOD</span>
                      <span className="text-slate-300 font-semibold">{satDetails.orbital_elements.orbital_period_min} mins</span>
                    </div>
                    {telemetry && (
                      <div className="flex justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-900/60">
                        <span className="text-slate-500">PROPAGATED SPEED</span>
                        <span className="text-slate-300 font-semibold">{telemetry.velocity.toFixed(3)} km/s</span>
                      </div>
                    )}
                  </div>

                  {/* Collision Threat Risks */}
                  <div className="flex flex-col gap-1.5 border-t border-slate-800/80 pt-2.5 mt-1">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Collision Risk Status</span>
                    {satDetails.active_conjunction_risks.length === 0 ? (
                      <div className="flex items-center gap-2 p-2 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 rounded-xl">
                        <Shield className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">No active threats detected</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {satDetails.active_conjunction_risks.map((threat: any) => {
                          const isHigh = threat.collision_probability >= 1e-4;
                          return (
                            <div key={threat.event_id} className={`flex flex-col gap-1 p-2.5 rounded-xl border ${
                              isHigh 
                                ? 'bg-red-950/20 border-red-500/25 text-red-400 animate-pulse'
                                : 'bg-amber-950/20 border-amber-500/25 text-amber-400'
                            }`}>
                              <div className="flex items-center justify-between font-bold text-[9px] uppercase tracking-wider mb-0.5">
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Conjunction Alert
                                </span>
                                <span className="font-mono text-right">{threat.collision_probability.toExponential(1)} Pc</span>
                              </div>
                              <div className="flex justify-between text-[9px]">
                                <span className="text-slate-500">OBJECT</span>
                                <span className="font-bold truncate max-w-[120px]">{threat.other_name} ({threat.other_type})</span>
                              </div>
                              <div className="flex justify-between text-[9px]">
                                <span className="text-slate-500">MISS DISTANCE</span>
                                <span className="font-semibold">{threat.miss_distance_km.toFixed(3)} km</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}      {/* Telemetry HUD Panel Overlay */}
      {telemetry && (
        <div className="absolute bottom-6 left-6 z-10 flex flex-col items-start">
          {isHudCollapsed ? (
            <button
              onClick={() => setIsHudCollapsed(false)}
              className="glassmorphism p-3 rounded-xl border border-slate-700/50 hover:border-blue-500/55 hover:bg-slate-900/60 shadow-2xl text-blue-450 transition-all flex items-center gap-2 cursor-pointer"
              title="Expand Telemetry HUD"
            >
              <Shield className="h-4 w-4" />
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider pr-1">Telemetry HUD</span>
            </button>
          ) : (
            <div className="glassmorphism rounded-2xl p-5 w-80 border border-slate-700/50 shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <h4 className="font-mono text-sm font-semibold tracking-wider text-slate-100 uppercase truncate max-w-[150px]">
                    {telemetry.name}
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsHudCollapsed(true)}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                    title="Collapse Panel"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    onClick={() => {
                      if (viewerRef.current && viewerRef.current.cesiumElement) {
                        viewerRef.current.cesiumElement.selectedEntity = undefined;
                      }
                    }} 
                    className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">NORAD ID</span>
                  <span className="text-slate-300 font-semibold">{telemetry.noradId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">OPERATOR</span>
                  <span className="text-slate-300 font-semibold">{telemetry.operator}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TYPE</span>
                  <span className={`font-semibold uppercase ${
                    telemetry.type.toLowerCase().includes('debris') ? 'text-red-400' : 'text-blue-400'
                  }`}>{telemetry.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ALTITUDE</span>
                  <span className="text-slate-300 font-semibold">{telemetry.altitude.toFixed(2)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">VELOCITY</span>
                  <span className="text-slate-300 font-semibold">{telemetry.velocity.toFixed(3)} km/s</span>
                </div>
                <div className="flex justify-between border-t border-slate-900/60 pt-2 mt-1">
                  <span className="text-slate-500">LATITUDE</span>
                  <span className="text-slate-300 font-semibold">{telemetry.latitude.toFixed(4)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">LONGITUDE</span>
                  <span className="text-slate-300 font-semibold">{telemetry.longitude.toFixed(4)}°</span>
                </div>

                {/* Space Weather Drag Impact */}
                <div className="border-t border-slate-900/60 pt-2 mt-1.5 flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider block mb-0.5">
                    Space Weather Impact
                  </span>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">ORBITAL DRAG</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border
                      ${telemetry.dragStatus === 'Critical' ? 'bg-red-950/60 text-red-400 border-red-500/30 pulse-red' : ''}
                      ${telemetry.dragStatus === 'Elevated' ? 'bg-amber-950/60 text-amber-450 border-amber-500/30' : ''}
                      ${telemetry.dragStatus === 'Moderate' ? 'bg-yellow-950/60 text-yellow-400 border-yellow-500/30' : ''}
                      ${telemetry.dragStatus === 'Nominal' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : ''}
                      ${telemetry.dragStatus === 'Negligible' ? 'bg-slate-900 text-slate-500 border-slate-800' : ''}
                    `}>
                      {telemetry.dragStatus}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">DECAY RATE</span>
                    <span className="text-slate-300 font-semibold">
                      {telemetry.decayRate && telemetry.decayRate > 0.001 
                        ? `${telemetry.decayRate.toFixed(2)} m / day` 
                        : 'Negligible'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-550 font-semibold">DRAG MULTIPLIER</span>
                    <span className={`font-semibold
                      ${telemetry.dragScale && telemetry.dragScale > 2.0 ? 'text-red-400' : 'text-slate-300'}
                    `}>
                      {telemetry.dragScale ? `${telemetry.dragScale.toFixed(2)}x` : '1.00x'}
                    </span>
                  </div>
                </div>
                {/* Maneuver Delta-V Simulation */}
                {isTracking && (
                  <div className="flex flex-col gap-1.5 mt-3 border-t border-slate-900/60 pt-2.5 font-mono">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-550 uppercase tracking-wider">
                      <span>Simulate Burn (Radial)</span>
                      <span className="text-amber-400 font-bold">{maneuverDeltaV > 0 ? `+${maneuverDeltaV}` : maneuverDeltaV} m/s</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="2"
                      value={maneuverDeltaV}
                      onChange={(e) => setManeuverDeltaV(Number(e.target.value))}
                      className="w-full accent-amber-500 bg-slate-950 border border-slate-850 rounded-lg cursor-pointer h-1.5"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500">
                      <span>-50 m/s (Inward)</span>
                      <span>+50 m/s (Outward)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* HUD Action Toggles */}
              <div className="flex flex-col gap-2 mt-4 border-t border-slate-800/80 pt-3">
                <div className="flex gap-2">
                  <button
                    onClick={handleTrackEntity}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-slate-100 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Track Orbit
                  </button>
                  <button
                    onClick={handleUntrackEntity}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Reset View
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    const noradId = telemetry.noradId;
                    setSelectedSatIds(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(noradId)) {
                        newSet.delete(noradId);
                      } else {
                        newSet.add(noradId);
                      }
                      return newSet;
                    });
                  }}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer
                    ${selectedSatIds.has(telemetry.noradId)
                      ? 'bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/35'
                      : 'bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-350'
                    }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  {selectedSatIds.has(telemetry.noradId) ? "Unpin Trajectory Line" : "Pin Trajectory Line"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
