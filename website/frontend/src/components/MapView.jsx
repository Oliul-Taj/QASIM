import { useEngine } from '../context/EngineContext';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { generateRoadmap } from '../utils/engine';
import { useEffect, useRef, useState } from 'react';
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react';

const MapInteractHandler = () => {
  const { setSelectedDistrict } = useEngine();
  const mapRef = useRef(null);
  useMapEvents({
    click: (e) => {
      // Only close sidebar if clicking on empty map area (NOT on district)
      if (e.sourceTarget && e.sourceTarget.feature) return;
      // Clicking empty area closes sidebar
      setSelectedDistrict(null);
    }
  });
  return null;
};

const BGD_CENTER = [23.6850, 90.3563];
const BGD_ZOOM = 7;

// Exact colors per spec
const COLORS = {
  red:     { normal: '#ff0000', blink: '#ff4d00' },
  yellow:  { normal: '#ff9a00', blink: '#ffc100' },
  green:   { normal: '#34c62c', blink: '#8ce03a' },
  default: '#64748b',
};

// Map controls — bottom left, beside legend
const MapControls = ({ onRecenter }) => {
  const map = useMap();
  return (
    <div className="absolute bottom-6 left-6 z-[1001] flex flex-col gap-1.5">
      <button
        onClick={() => map.zoomIn()}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-slate-500/50"
        style={{ background: 'rgba(15,23,42,0.85)' }}
        title="Zoom in"
      >
        <ZoomIn className="w-4 h-4 text-slate-200" />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-slate-500/50"
        style={{ background: 'rgba(15,23,42,0.85)' }}
        title="Zoom out"
      >
        <ZoomOut className="w-4 h-4 text-slate-200" />
      </button>
      <button
        onClick={() => map.setView(BGD_CENTER, BGD_ZOOM)}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-blue-500/50"
        style={{ background: 'rgba(15,23,42,0.85)' }}
        title="Re-center Bangladesh"
      >
        <Crosshair className="w-4 h-4 text-blue-400" />
      </button>
    </div>
  );
};

export const MapView = () => {
  const {
    geojsonData, districtData, selectedDistrict,
    setSelectedDistrict, targetConnectivity, timeframe,
    mvtWeights, setRoadmap, analysisComplete, priorityDistricts,
    activeYear, setActiveYear
  } = useEngine();

  const [blinkOn, setBlinkOn] = useState(true);
  const [selectedBlink, setSelectedBlink] = useState(false);
  const [selectedBlinkActive, setSelectedBlinkActive] = useState(false);
  const geoJsonKey = useRef(0);

  // Priority blink — only after analysis, 0.5 sec interval
  useEffect(() => {
    if (!analysisComplete) return;
    const interval = setInterval(() => setBlinkOn(p => !p), 500);
    return () => clearInterval(interval);
  }, [analysisComplete]);

  // Selected district blink — 1 sec blink
  useEffect(() => {
    if (!selectedDistrict) {
      setSelectedBlinkActive(false);
      setSelectedBlink(false);
      return;
    }
    // Start blinking immediately (1s interval handled in next effect)
    setSelectedBlinkActive(true);
  }, [selectedDistrict]);

  useEffect(() => {
    if (!selectedBlinkActive) return;
    const interval = setInterval(() => setSelectedBlink(p => !p), 1000);
    return () => clearInterval(interval);
  }, [selectedBlinkActive]);

  // Force GeoJSON re-render
  useEffect(() => {
    geoJsonKey.current += 1;
  }, [blinkOn, selectedBlink, selectedBlinkActive, priorityDistricts, districtData, selectedDistrict, activeYear]);

  const getSimulatedStatus = (baseConn, year) => {
    const mod = year === 2022 ? 0.78 : year === 2023 ? 0.86 : year === 2024 ? 0.94 : 1.0;
    const effConn = baseConn * mod;
    let status = 'red';
    if (effConn >= targetConnectivity) status = 'green';
    else if (effConn >= targetConnectivity * 0.55) status = 'yellow';
    return { effConn, status };
  };

  const getStyle = (feature) => {
    const name = feature.properties.NAME_2 || feature.properties.ADM2_EN || feature.properties.name;
    const data = districtData.find(d => d.name === name);
    const isSelected = selectedDistrict?.name === name;
    const isPriority = analysisComplete && priorityDistricts.has(name);

    if (!data) return {
      fillColor: COLORS.default,
      weight: 1, opacity: 1,
      color: '#000000',
      fillOpacity: 0.7
    };

    const { status } = getSimulatedStatus(data.connectivity, activeYear);
    const palette = COLORS[status] || { normal: COLORS.default, blink: COLORS.default };

    // Selected district — thick black border, blink after 5s delay
    if (isSelected) {
      const fillColor = selectedBlinkActive
        ? (selectedBlink ? palette.blink : palette.normal)
        : palette.normal;
      return {
        fillColor,
        weight: 3,
        opacity: 1,
        color: '#000000',
        fillOpacity: 0.9,
      };
    }

    // Priority districts — blink color but BLACK border always
    if (isPriority) {
      const fillColor = blinkOn ? palette.blink : palette.normal;
      return {
        fillColor,
        weight: 1.5,
        opacity: 1,
        color: '#000000',
        fillOpacity: 0.78,
      };
    }

    // Normal
    return {
      fillColor: palette.normal,
      weight: 1,
      opacity: 1,
      color: '#000000',
      fillOpacity: 0.72,
    };
  };

  const handleDistrictClick = (feature) => {
    const name = feature.properties.NAME_2 || feature.properties.ADM2_EN || feature.properties.name || "Unknown";
    const data = districtData.find(d => d.name === name);
    if (data) {
      setSelectedDistrict(data);
      setRoadmap(generateRoadmap(data, targetConnectivity, timeframe, mvtWeights));
    }
  };

  const onEachFeature = (feature, layer) => {
    const name = feature.properties.NAME_2 || feature.properties.ADM2_EN || feature.properties.name;
    const data = districtData.find(d => d.name === name);
    const isPriority = analysisComplete && priorityDistricts.has(name);
    const isSelected = selectedDistrict?.name === name;

    const sim = data ? getSimulatedStatus(data.connectivity, activeYear) : null;

    layer.bindTooltip(
      `<b>${name}</b>${data ? `<br/>Connectivity (${activeYear}): ${sim.effConn.toFixed(1)}%<br/>Status: ${sim.status?.toUpperCase()}` : ''}${isPriority ? '<br/><span style="color:#ffc100">⚡ Priority Focus</span>' : ''}${isSelected ? '<br/><span style="color:#60a5fa">● Selected</span>' : ''}`,
      { direction: 'auto', offset: [15, 0], sticky: false }
    );

    layer.on({
      mouseover: (e) => {
        if (selectedDistrict?.name !== name) {
          e.target.setStyle({ weight: 2.5, color: '#3b82f6', fillOpacity: 0.92 });
          e.target.bringToFront();
        }
      },
      mouseout: (e) => { e.target.setStyle(getStyle(feature)); },
      click: () => handleDistrictClick(feature)
    });
  };

  if (!geojsonData) return <div className="text-white p-6">Loading Geospatial Data...</div>;

  return (
    <div className="flex h-full w-full relative">
      <div className="flex-1 w-full h-full relative" style={{ zIndex: 1 }}>
        <MapContainer
          center={BGD_CENTER} zoom={BGD_ZOOM}
          scrollWheelZoom={true} dragging={true}
          style={{ height: '100%', width: '100%', background: '#0a0f1c' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          <GeoJSON
            key={geoJsonKey.current}
            data={geojsonData}
            style={getStyle}
            onEachFeature={onEachFeature}
          />
          <MapControls />
          <MapInteractHandler />
        </MapContainer>

        {/* Legend + controls side by side bottom left */}
        <div className="absolute bottom-6 left-16 z-[1000] glass-panel p-4 rounded-xl text-sm"
             style={{ background: 'rgba(10,15,28,0.88)' }}>
          <h3 className="font-bold mb-3 text-slate-200 text-xs uppercase tracking-wider">Connectivity Status</h3>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3.5 h-3.5 rounded-sm" style={{ background: COLORS.red.normal, boxShadow: `0 0 8px ${COLORS.red.normal}88` }}></div>
            <span className="text-xs text-slate-300">Critical (below 50% of target)</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3.5 h-3.5 rounded-sm" style={{ background: COLORS.yellow.normal, boxShadow: `0 0 8px ${COLORS.yellow.normal}88` }}></div>
            <span className="text-xs text-slate-300">Transitioning (50–99%)</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3.5 h-3.5 rounded-sm" style={{ background: COLORS.green.normal, boxShadow: `0 0 8px ${COLORS.green.normal}88` }}></div>
            <span className="text-xs text-slate-300">Target Met (≥ target)</span>
          </div>
          {analysisComplete && priorityDistricts.size > 0 && (
            <div className="border-t border-slate-700 pt-2 flex items-center gap-2 text-xs text-yellow-400">
              <div className="w-3 h-3 rounded-sm animate-pulse" style={{ background: COLORS.yellow.blink }}></div>
              <span>Blinking = {priorityDistricts.size} Priority Districts</span>
            </div>
          )}
          {selectedDistrict && (
            <div className="border-t border-slate-700 pt-2 mt-2 flex items-center gap-2 text-xs text-blue-400">
              <div className="w-3 h-3 rounded-sm border-2 border-black" style={{ background: COLORS[selectedDistrict.status]?.normal }}></div>
              <span>{selectedDistrict.name} selected</span>
            </div>
          )}
        </div>

        {/* Priority badge top */}
        {analysisComplete && priorityDistricts.size > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-1.5 rounded-full text-xs border border-yellow-500/30"
               style={{ background: 'rgba(10,15,28,0.85)' }}>
            <span className="text-yellow-400 font-bold">⚡ {priorityDistricts.size} districts</span>
            <span className="text-slate-400"> prioritized for {timeframe}-year goal</span>
          </div>
        )}

        {/* Timeline Controls (Top Right) */}
        {analysisComplete && (
          <div className="absolute top-6 right-6 z-[1000] p-1.5 rounded-xl border border-blue-500/30 shadow-xl flex items-center gap-1 backdrop-blur-md"
               style={{ background: 'rgba(10,15,28,0.85)' }}>
            <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wide">Train DB</span>
            {[2022, 2023, 2024, 2025].map(y => (
              <button
                key={y}
                onClick={() => setActiveYear(y)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeYear === y 
                  ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
