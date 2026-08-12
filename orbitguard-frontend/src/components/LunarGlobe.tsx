import React, { useRef, useState, useEffect } from 'react';
import { Viewer, Entity, PolylineGraphics, Globe, ImageryLayer } from 'resium';
import * as Cesium from 'cesium';

interface Crater {
  name: string;
  lat: number;
  lon: number;
  radius: number;
}

interface Waypoint {
  lat: number;
  lon: number;
  slope: number;
}

interface LunarGlobeProps {
  craters: Crater[];
  waypoints: Waypoint[];
}

export const LunarGlobe: React.FC<LunarGlobeProps> = ({ craters, waypoints }) => {
  const viewerRef = useRef<any>(null);
  const [lunarProvider, setLunarProvider] = useState<any>(null);

  // Initialize lunar imagery provider using factory pattern or constructor fallback
  useEffect(() => {
    const initImagery = async () => {
      try {
        const url = '/images/moon_texture.jpg';
        let provider;
        if (typeof (Cesium.SingleTileImageryProvider as any).fromUrl === 'function') {
          provider = await (Cesium.SingleTileImageryProvider as any).fromUrl(url);
        } else {
          provider = new (Cesium.SingleTileImageryProvider as any)({ url });
        }
        setLunarProvider(provider);
      } catch (err) {
        console.error("Failed to initialize lunar imagery provider:", err);
      }
    };
    initImagery();
  }, []);

  const handleViewerReady = (viewer: any) => {
    // 1. Focus camera on the Lunar South Pole (-90 latitude)
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(0, -89.0, 800000), // 800 km altitude
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0
      }
    });

    // Disable environment elements not suitable for Moon
    viewer.scene.skyAtmosphere.show = false;
    viewer.scene.globe.showWaterEffect = false;
    viewer.scene.globe.enableLighting = true; // Moon shadows
  };

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-800/80">
      <Viewer
        ref={viewerRef}
        full
        timeline={false}
        animation={false}
        navigationHelpButton={false}
        geocoder={false}
        homeButton={false}
        sceneModePicker={false}
        baseLayerPicker={false}
        infoBox={true}
        onReady={handleViewerReady}
        style={{ width: '100%', height: '100%' }}
        imageryProvider={false} // Disable default Earth base layers
        globe={new Cesium.Globe(Cesium.Ellipsoid.MOON)}
      >

        {/* Render Lunar base map imagery */}
        {lunarProvider && (
          <ImageryLayer imageryProvider={lunarProvider} />
        )}

        {/* 1. Draw Craters as red hazard rings */}
        {craters.map((crater, idx) => (
          <Entity
            key={`crater-${idx}`}
            name={`${crater.name} Crater Hazard Zone`}
            description={`Danger: Deep shadow, steep slope walls. Radius: ${crater.radius} km.`}
            position={Cesium.Cartesian3.fromDegrees(crater.lon, crater.lat, 100)}
            ellipse={{
              semiMinorAxis: crater.radius * 1000, // meters
              semiMajorAxis: crater.radius * 1000, // meters
              material: Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.20), // red translucent fill
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('#ef4444'),
              outlineWidth: 2,
              height: 100
            }}
          />
        ))}

        {/* 2. Draw Start point */}
        {waypoints.length > 0 && (
          <Entity
            name="Mission Start / Landing Zone"
            position={Cesium.Cartesian3.fromDegrees(waypoints[0].lon, waypoints[0].lat, 500)}
            point={{
              pixelSize: 12,
              color: Cesium.Color.fromCssColorString('#10b981'), // green
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2
            }}
          />
        )}

        {/* 3. Draw End point */}
        {waypoints.length > 1 && (
          <Entity
            name="Mission Destination / Rover Target"
            position={Cesium.Cartesian3.fromDegrees(waypoints[waypoints.length - 1].lon, waypoints[waypoints.length - 1].lat, 500)}
            point={{
              pixelSize: 12,
              color: Cesium.Color.fromCssColorString('#3b82f6'), // blue
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2
            }}
          />
        )}

        {/* 4. Draw Traversal Route Waypoints */}
        {waypoints.length > 1 && (
          <Entity name="Computed Rover Route">
            <PolylineGraphics
              positions={waypoints.map(wp => Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 200))}
              width={4}
              material={Cesium.Color.fromCssColorString('#06b6d4')} // Cyan neon line
            />
          </Entity>
        )}
      </Viewer>
    </div>
  );
};
