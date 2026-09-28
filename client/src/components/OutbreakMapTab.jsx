import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapIcon,
  ExpertIcon,
  ArrowRightIcon,
  LeafIcon,
  PestIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  LocationPinIcon,
  CloseIcon,
  UserIcon,
  BuildingIcon,
  ShieldIcon,
  FlameIcon,
  LockIcon,
  LayersIcon,
  TargetIcon,
  DatabaseIcon
} from "./Icons";

const API = "";

// Severity & Risk Color Palette
const RISK_COLORS = {
  CRITICAL_OUTBREAK: {
    primary: "#dc2626",
    bg: "rgba(220, 38, 38, 0.15)",
    border: "#ef4444",
    badge: "Critical Alert",
    pillBg: "#fee2e2",
    pillText: "#991b1b"
  },
  EMERGING_HOTSPOT: {
    primary: "#ea580c",
    bg: "rgba(234, 88, 12, 0.15)",
    border: "#f97316",
    badge: "Emerging Alert",
    pillBg: "#ffedd5",
    pillText: "#9a3412"
  },
  SPORADIC_DETECTION: {
    primary: "#ca8a04",
    bg: "rgba(202, 138, 4, 0.14)",
    border: "#eab308",
    badge: "Sporadic Watch",
    pillBg: "#fef9c3",
    pillText: "#854d0e"
  }
};

const SEVERITY_COLORS = {
  critical: "#ef4444",
  severe: "#f97316",
  moderate: "#eab308",
  low: "#10b981",
  pest: "#8b5cf6"
};

// 1. Hotspot Cluster Badge DivIcon for Leaflet
function createHotspotBadgeIcon(hotspot) {
  const isPest = hotspot.category === "pest";
  const riskConfig = RISK_COLORS[hotspot.riskLevel] || RISK_COLORS.EMERGING_HOTSPOT;
  const iconSvg = isPest
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${riskConfig.primary}" stroke-width="2"><rect width="8" height="14" x="8" y="6" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${riskConfig.primary}" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;

  return L.divIcon({
    className: "custom-hotspot-cluster-icon",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${riskConfig.primary}; opacity: 0.3; animation: ping-slow 2.2s infinite;"></div>
        <div style="
          background: #ffffff;
          border: 2px solid ${riskConfig.primary};
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
          border-radius: 20px;
          padding: 3px 8px;
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: inherit;
          white-space: nowrap;
          z-index: 20;
        ">
          <span style="display: inline-flex; align-items: center;">${iconSvg}</span>
          <span style="font-weight: 800; font-size: 12px; color: ${riskConfig.primary};">
            ${hotspot.totalCases} ${hotspot.totalCases === 1 ? 'Case' : 'Cases'}
          </span>
        </div>
      </div>
    `,
    iconSize: [80, 36],
    iconAnchor: [40, 18],
    popupAnchor: [0, -22]
  });
}

// 2. Anonymized Observation Pin DivIcon
function createObservationIcon(type, severity) {
  const isPest = type === "pest";
  const sevKey = (severity || "moderate").toLowerCase();
  const color = isPest ? SEVERITY_COLORS.pest : (SEVERITY_COLORS[sevKey] || SEVERITY_COLORS.moderate);
  const iconSvg = isPest
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><rect width="8" height="14" x="8" y="6" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;

  return L.divIcon({
    className: "custom-observation-marker",
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <div style="width: 26px; height: 26px; border-radius: 50%; background: ${color}; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; color: #fff;">
          ${iconSvg}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

// 3. User Farmer Beacon DivIcon
function createUserBeaconIcon() {
  const beaconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a7 7 0 0 1 13 0v2"/></svg>`;
  return L.divIcon({
    className: "custom-farmer-beacon",
    html: `
      <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: #3b82f6; opacity: 0.35; animation: ping-slow 2.4s infinite;"></div>
        <div style="width: 30px; height: 30px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(37,99,235,0.4); display: flex; align-items: center; justify-content: center; color: #fff;">
          ${beaconSvg}
        </div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20]
  });
}

export default function OutbreakMapTab({ user, activeScan, onNavigateToExpert }) {
  // Check if there is an active scan location from Disease or Pest tab
  const getInitialActiveScan = () => {
    if (activeScan?.lat && activeScan?.lon) return activeScan;
    try {
      const stored = localStorage.getItem("agri_active_scan_location");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  };

  const initialScan = getInitialActiveScan();

  const defaultCoords = initialScan?.lat && initialScan?.lon
    ? { lat: parseFloat(initialScan.lat), lon: parseFloat(initialScan.lon) }
    : (user?.district?.toLowerCase() === "nashik" 
        ? { lat: 20.0059, lon: 73.7898 } 
        : { lat: 16.8524, lon: 74.5815 });

  const defaultLocName = initialScan?.locationName
    ? initialScan.locationName
    : (user?.district ? `${user.district}, Maharashtra` : "Sangli, Maharashtra");

  const [farmerCoords, setFarmerCoords] = useState(defaultCoords);
  const [farmerLocName, setFarmerLocName] = useState(defaultLocName);
  const [activeScanMetadata, setActiveScanMetadata] = useState(initialScan);
  const [radiusKm, setRadiusKm] = useState(25);
  
  // Feature Modes & Channels
  const [viewMode, setViewMode] = useState("hotspots"); // 'hotspots' (DBSCAN clusters) | 'observations' (Individual pins)
  const [categoryFilter, setCategoryFilter] = useState(() => {
    return initialScan?.category === "pest" ? "pest" : initialScan?.category === "disease" ? "disease" : "all";
  });
  const [userRole, setUserRole] = useState("farmer"); // 'farmer' (Protection Shield) | 'officer' (Surveillance & KVK)
  const [showArchModal, setShowArchModal] = useState(false);

  // Recenter map on active scan
  const recenterOnActiveScan = () => {
    if (activeScanMetadata?.lat && activeScanMetadata?.lon) {
      const coords = { lat: parseFloat(activeScanMetadata.lat), lon: parseFloat(activeScanMetadata.lon) };
      setFarmerCoords(coords);
      if (activeScanMetadata.locationName) setFarmerLocName(activeScanMetadata.locationName);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([coords.lat, coords.lon], 12, { duration: 1.0 });
      }
    }
  };

  // Sync when activeScan prop updates from other tabs
  useEffect(() => {
    if (activeScan?.lat && activeScan?.lon) {
      const coords = { lat: parseFloat(activeScan.lat), lon: parseFloat(activeScan.lon) };
      setFarmerCoords(coords);
      if (activeScan.locationName) setFarmerLocName(activeScan.locationName);
      setActiveScanMetadata(activeScan);
      if (activeScan.category) setCategoryFilter(activeScan.category);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([coords.lat, coords.lon], radiusKm > 30 ? 9 : radiusKm > 15 ? 10 : 11, {
          duration: 1.1
        });
      }
    }
  }, [activeScan]);

  // Data States
  const [hotspots, setHotspots] = useState([]);
  const [hotspotAnalytics, setHotspotAnalytics] = useState(null);
  const [rawReports, setRawReports] = useState([]);
  const [spatialSummary, setSpatialSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  // Map References
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const clusterLayerRef = useRef(null);
  const reportsLayerRef = useRef(null);
  const radiusCircleRef = useRef(null);
  const farmerMarkerRef = useRef(null);
  const clusterMarkersMapRef = useRef(new Map());

  // 1. Fetch Hotspots and Spatial Data from PostGIS
  const fetchSpatialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch PostGIS Clustered Hotspots (ST_ClusterDBSCAN)
      const hotspotRes = await fetch(
        `${API}/api/spatial/hotspots?category=${categoryFilter}&days=45&lat=${farmerCoords.lat}&lon=${farmerCoords.lon}`
      );
      if (hotspotRes.ok) {
        const hotspotData = await hotspotRes.json();
        if (hotspotData && hotspotData.success) {
          setHotspots(hotspotData.hotspots || []);
          setHotspotAnalytics(hotspotData.analytics || null);
        }
      }

      // 2. Fetch Anonymized Nearby Field Reports (ST_DWithin)
      const nearbyRes = await fetch(
        `${API}/api/spatial/nearby?lat=${farmerCoords.lat}&lon=${farmerCoords.lon}&radiusKm=${radiusKm}&type=${categoryFilter}`
      );
      if (nearbyRes.ok) {
        const nearbyData = await nearbyRes.json();
        if (nearbyData && nearbyData.success) {
          setRawReports(nearbyData.reports || []);
        }
      }

      // 3. Spatial Summary for Proximity Radar
      const summaryRes = await fetch(
        `${API}/api/spatial/summary?lat=${farmerCoords.lat}&lon=${farmerCoords.lon}&radiusKm=${radiusKm}`
      );
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        if (summaryData && summaryData.success) {
          setSpatialSummary(summaryData.summary);
        }
      }
    } catch (err) {
      console.warn("Could not fetch spatial hotspot data (using offline mode):", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpatialData();
  }, [farmerCoords, radiusKm, categoryFilter, activeScanMetadata?.timestamp]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [farmerCoords.lat, farmerCoords.lon],
      zoom: 11,
      zoomControl: true
    });

    // Standard OpenStreetMap Tile Layer (Clean, crisp, no API key needed)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Layer Groups
    const clusterGroup = L.layerGroup().addTo(map);
    const reportsGroup = L.layerGroup().addTo(map);
    clusterLayerRef.current = clusterGroup;
    reportsLayerRef.current = reportsGroup;

    // Farmer Location Marker
    const farmerMarker = L.marker([farmerCoords.lat, farmerCoords.lon], {
      icon: createUserBeaconIcon(),
      zIndexOffset: 1000
    }).addTo(map);

    const getFarmerPopupContent = () => `
      <div style="font-family: inherit; font-size: 13px;">
        <strong style="color: #2563eb; display: block; font-size: 14px;">
          ${activeScanMetadata ? 'Active Scanned Field' : 'Your Farm Location'}
        </strong>
        <span style="color: #0f172a; font-weight: 600;">${farmerLocName}</span>
        ${activeScanMetadata ? `
          <div style="margin-top: 5px; font-size: 11.5px; color: #0369a1; background: #e0f2fe; padding: 4px 6px; border-radius: 4px;">
            ${activeScanMetadata.category === 'pest' ? 'Scanned Pest Trap:' : 'Scanned Disease:'} <strong>${activeScanMetadata.crop}</strong> · <strong>${activeScanMetadata.condition}</strong>
          </div>
        ` : ""}
        <div style="margin-top: 6px; font-size: 11.5px; color: #64748b;">
          PostGIS Vigilance Radius: <strong>${radiusKm} km</strong>
        </div>
      </div>
    `;

    farmerMarker.bindPopup(getFarmerPopupContent());
    farmerMarkerRef.current = farmerMarker;
    if (activeScanMetadata) {
      farmerMarker.openPopup();
    }

    // Farmer Vigilance Radius Circle
    const circle = L.circle([farmerCoords.lat, farmerCoords.lon], {
      radius: radiusKm * 1000,
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: "5, 5"
    }).addTo(map);

    radiusCircleRef.current = circle;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 3. Update Farmer Marker & Radius Circle when location changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const popupContent = `
      <div style="font-family: inherit; font-size: 13px;">
        <strong style="color: #2563eb; display: block; font-size: 14px;">
          ${activeScanMetadata ? 'Active Scanned Field' : 'Your Farm Location'}
        </strong>
        <span style="color: #0f172a; font-weight: 600;">${farmerLocName}</span>
        ${activeScanMetadata ? `
          <div style="margin-top: 5px; font-size: 11.5px; color: #0369a1; background: #e0f2fe; padding: 4px 6px; border-radius: 4px;">
            ${activeScanMetadata.category === 'pest' ? 'Scanned Pest Trap:' : 'Scanned Disease:'} <strong>${activeScanMetadata.crop}</strong> · <strong>${activeScanMetadata.condition}</strong>
          </div>
        ` : ""}
        <div style="margin-top: 6px; font-size: 11.5px; color: #64748b;">
          PostGIS Vigilance Radius: <strong>${radiusKm} km</strong>
        </div>
      </div>
    `;

    if (farmerMarkerRef.current) {
      farmerMarkerRef.current.setLatLng([farmerCoords.lat, farmerCoords.lon]);
      farmerMarkerRef.current.getPopup()?.setContent(popupContent);
      if (activeScanMetadata) {
        farmerMarkerRef.current.openPopup();
      }
    }

    if (radiusCircleRef.current) {
      radiusCircleRef.current.setLatLng([farmerCoords.lat, farmerCoords.lon]);
      radiusCircleRef.current.setRadius(radiusKm * 1000);
    }

    map.flyTo([farmerCoords.lat, farmerCoords.lon], radiusKm > 30 ? 9 : radiusKm > 15 ? 10 : 11, {
      duration: 1.1
    });
  }, [farmerCoords, radiusKm, farmerLocName, activeScanMetadata]);

  // 4. Render PostGIS DBSCAN Hotspots on Leaflet
  useEffect(() => {
    if (!clusterLayerRef.current) return;
    const clusterGroup = clusterLayerRef.current;
    clusterGroup.clearLayers();
    clusterMarkersMapRef.current.clear();

    if (viewMode !== "hotspots") return;

    hotspots.forEach((hs) => {
      const riskConfig = RISK_COLORS[hs.riskLevel] || RISK_COLORS.EMERGING_HOTSPOT;
      const isPest = hs.category === "pest";

      // 1. Hotspot Spread Buffer Circle (ST_Buffer)
      const hotspotCircle = L.circle([hs.center.lat, hs.center.lon], {
        radius: hs.radiusMeters,
        color: riskConfig.primary,
        fillColor: riskConfig.primary,
        fillOpacity: 0.16,
        weight: 2,
        dashArray: hs.riskLevel === "CRITICAL_OUTBREAK" ? "6, 4" : null
      });

      // 2. Central Hotspot Badge Marker
      const badgeMarker = L.marker([hs.center.lat, hs.center.lon], {
        icon: createHotspotBadgeIcon(hs),
        zIndexOffset: hs.riskLevel === "CRITICAL_OUTBREAK" ? 500 : 200
      });

      // 3. Rich Hotspot Detail Popup
      const popupHtml = `
        <div style="font-family: inherit; width: 260px; font-size: 12.5px; line-height: 1.45;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; background: ${riskConfig.pillBg}; color: ${riskConfig.pillText}; padding: 2px 7px; border-radius: 4px;">
              ${riskConfig.badge}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #475569; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">
              ${hs.trend}
            </span>
          </div>

          <h3 style="margin: 0 0 2px 0; font-size: 15px; color: #0f172a; font-weight: 800;">
            ${hs.conditionName}
          </h3>
          <div style="color: #64748b; font-size: 12px; margin-bottom: 8px;">
            Affected Crop: <strong style="color: #1e293b;">${hs.crop || "Crop"}</strong> · 
            <span>${(hs.affectedVillages || []).slice(0, 3).join(", ") || "Cluster Region"}</span>
          </div>

          <!-- Hotspot Metrics Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; font-size: 11.5px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 6px;">
              <span style="color: #64748b; display: block; font-size: 10px;">TOTAL CASES</span>
              <strong style="color: ${riskConfig.primary}; font-size: 13px;">${hs.totalCases} Verified</strong>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 6px;">
              <span style="color: #64748b; display: block; font-size: 10px;">CLUSTER RADIUS</span>
              <strong style="color: #334155; font-size: 13px;">${hs.radiusKm} km</strong>
            </div>
          </div>

          ${hs.distanceFromUserKm !== null ? `
            <div style="background: ${hs.distanceFromUserKm < 10 ? '#fef2f2' : '#f0fdf4'}; border-left: 3px solid ${hs.distanceFromUserKm < 10 ? '#ef4444' : '#10b981'}; padding: 5px 8px; border-radius: 4px; font-size: 11px; margin-bottom: 8px;">
              <strong>${hs.distanceFromUserKm < 10 ? 'High Threat Proximity:' : 'Distance from farm:'}</strong> 
              ${hs.distanceFromUserKm} km away
            </div>
          ` : ""}

          <!-- Prevention Advisory -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 8px; border-radius: 6px; font-size: 11px; color: #166534; margin-bottom: 6px;">
            <strong>Prevention Protocol:</strong><br/>
            ${hs.preventiveAdvisory}
          </div>

          <!-- Officer Guidance -->
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 5px 8px; border-radius: 6px; font-size: 10.5px; color: #475569;">
            <strong>KVK / Officer Action:</strong> ${hs.officerAction}
          </div>
        </div>
      `;

      badgeMarker.bindPopup(popupHtml);
      hotspotCircle.bindPopup(popupHtml);

      badgeMarker.on("click", () => setSelectedHotspot(hs));
      hotspotCircle.on("click", () => setSelectedHotspot(hs));

      clusterGroup.addLayer(hotspotCircle);
      clusterGroup.addLayer(badgeMarker);
      clusterMarkersMapRef.current.set(hs.hotspotId, badgeMarker);
    });
  }, [hotspots, viewMode]);

  // 5. Render Individual Anonymized Field Reports
  useEffect(() => {
    if (!reportsLayerRef.current) return;
    const reportsGroup = reportsLayerRef.current;
    reportsGroup.clearLayers();

    if (viewMode !== "observations") return;

    rawReports.forEach((rep) => {
      const isPest = rep.report_type === "pest";
      const icon = createObservationIcon(rep.report_type, rep.severity);
      const marker = L.marker([rep.latitude, rep.longitude], { icon });

      const popupHtml = `
        <div style="font-family: inherit; width: 230px; font-size: 12.5px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span style="font-size: 10.5px; font-weight: 700; color: #64748b;">
              ID: ${rep.observation_id}
            </span>
            <span style="font-weight: 700; font-size: 11px; color: #047857; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">
              ${rep.distance_km} km away
            </span>
          </div>
          <h4 style="margin: 0 0 2px 0; font-size: 14px; color: #1e293b; font-weight: 700;">
            ${rep.condition}
          </h4>
          <div style="color: #64748b; font-size: 11.5px; margin-bottom: 6px;">
            Crop: <strong style="color: #334155;">${rep.crop}</strong> · 
            <span>${rep.village ? `${rep.village}, ` : ""}${rep.district || ""}</span>
          </div>
          <div style="background: #f1f5f9; padding: 4px 6px; border-radius: 4px; font-size: 11px; margin-bottom: 6px;">
            Severity: <strong>${rep.severity}</strong> · Match: <strong>${Math.round((rep.confidence || 0.9) * 100)}%</strong>
          </div>
          ${rep.spray && rep.spray !== "N/A" ? `
            <div style="background: rgba(16, 185, 129, 0.08); border-left: 3px solid #10b981; padding: 4px 6px; border-radius: 4px; font-size: 10.5px; color: #065f46;">
              <strong>Action:</strong> ${rep.spray}
            </div>
          ` : ""}
          <div style="margin-top: 5px; font-size: 9.5px; color: #94a3b8; text-align: right;">
            Farmer identity protected
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      reportsGroup.addLayer(marker);
    });
  }, [rawReports, viewMode]);

  // Click on a hotspot card to fly to centroid on map
  const focusHotspotOnMap = (hs) => {
    setSelectedHotspot(hs);
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.flyTo([hs.center.lat, hs.center.lon], 12.5, { duration: 1.0 });

    const marker = clusterMarkersMapRef.current.get(hs.hotspotId);
    if (marker) {
      setTimeout(() => marker.openPopup(), 1100);
    }
  };

  // Location Preset Handler
  const handleLocationPreset = (preset) => {
    if (preset === "sangli") {
      setFarmerCoords({ lat: 16.8524, lon: 74.5815 });
      setFarmerLocName("Sangli, Maharashtra");
    } else if (preset === "nashik") {
      setFarmerCoords({ lat: 20.0059, lon: 73.7898 });
      setFarmerLocName("Nashik, Maharashtra");
    } else if (preset === "pune") {
      setFarmerCoords({ lat: 18.5204, lon: 73.8567 });
      setFarmerLocName("Pune, Maharashtra");
    } else if (preset === "solapur") {
      setFarmerCoords({ lat: 17.6599, lon: 75.9064 });
      setFarmerLocName("Solapur, Maharashtra");
    } else if (preset === "ahmednagar") {
      setFarmerCoords({ lat: 19.0952, lon: 74.7496 });
      setFarmerLocName("Ahmednagar, Maharashtra");
    }
  };

  return (
    <div className="spatial-outbreak-container">
      {/* ── 1. Top Section Header ────────────────────────────────────── */}
      <div className="section-header" style={{ marginBottom: "0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <MapIcon size={24} color="#16a34a" />
              <span>Geospatial Outbreak &amp; Hotspot Intelligence</span>
            </h2>
            <p>
              Epidemiological disease cluster mapping, pest hotspot clustering, and preventive containment powered by <strong>PostgreSQL + PostGIS + Leaflet</strong>.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setShowArchModal(true)}
              style={{
                background: "rgba(37,99,235,0.08)",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "0.4rem 0.8rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <LayersIcon size={14} style={{ marginRight: "4px" }} /> View Technical Architecture
            </button>
            <span className="sidebar-badge" style={{ background: "rgba(16,185,129,0.12)", color: "#047857", border: "1px solid #10b981", fontWeight: 700, padding: "0.35rem 0.75rem", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <DatabaseIcon size={14} color="#047857" /> PostGIS 3.6 DBSCAN Active
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Strict Privacy Guarantee Banner ───────────────────────── */}
      <div style={{
        background: "linear-gradient(90deg, #f0fdf4 0%, #ecfdf5 100%)",
        border: "1px solid #bbf7d0",
        borderRadius: "10px",
        padding: "0.6rem 1rem",
        marginBottom: "0.85rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.5rem",
        fontSize: "0.82rem",
        color: "#166534"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <LockIcon size={16} color="#166534" />
          <span>
            <strong>Zero Personal Identity Stored on Map:</strong> Farmer names and phone numbers are strictly protected. Outbreaks are aggregated into geographic clusters (PostGIS DBSCAN) for community biosecurity.
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setUserRole("farmer")}
            style={{
              padding: "0.25rem 0.65rem",
              borderRadius: "6px",
              fontSize: "0.78rem",
              fontWeight: userRole === "farmer" ? 700 : 500,
              background: userRole === "farmer" ? "#166534" : "#ffffff",
              color: userRole === "farmer" ? "#ffffff" : "#166534",
              border: "1px solid #166534",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <UserIcon size={13} color={userRole === "farmer" ? "#ffffff" : "#166534"} /> Farmer View
          </button>
          <button
            type="button"
            onClick={() => setUserRole("officer")}
            style={{
              padding: "0.25rem 0.65rem",
              borderRadius: "6px",
              fontSize: "0.78rem",
              fontWeight: userRole === "officer" ? 700 : 500,
              background: userRole === "officer" ? "#1e40af" : "#ffffff",
              color: userRole === "officer" ? "#ffffff" : "#1e40af",
              border: "1px solid #1e40af",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <BuildingIcon size={13} color={userRole === "officer" ? "#ffffff" : "#1e40af"} /> Agricultural Officer View
          </button>
        </div>
      </div>

      {/* ── 2.5. Active Upload Field Location Sync Banner ───────────── */}
      {activeScanMetadata && (
        <div style={{
          background: "linear-gradient(90deg, #eff6ff 0%, #ecfeff 100%)",
          border: "1.5px solid #38bdf8",
          borderRadius: "10px",
          padding: "0.75rem 1.1rem",
          marginBottom: "0.85rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.6rem",
          boxShadow: "0 2px 6px rgba(14,165,233,0.08)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", color: "#0284c7" }}>
              <TargetIcon size={22} color="#0284c7" />
            </span>
            <div>
              <div style={{ fontWeight: 800, color: "#0369a1", fontSize: "0.92rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>Active Upload Location Synchronized</span>
                <span style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  background: activeScanMetadata.category === "pest" ? "rgba(139,92,246,0.15)" : "rgba(239,68,68,0.15)",
                  color: activeScanMetadata.category === "pest" ? "#7c3aed" : "#dc2626",
                  padding: "1px 6px",
                  borderRadius: "4px"
                }}>
                  {activeScanMetadata.category === "pest" ? "Pest Trap Scan" : "Disease Scan"}
                </span>
              </div>
              <div style={{ color: "#334155", fontSize: "0.83rem", marginTop: "2px" }}>
                Outbreak GIS Map is evaluating spatial risks around your uploaded <strong>{activeScanMetadata.crop} ({activeScanMetadata.condition})</strong> at <strong>{activeScanMetadata.locationName}</strong> [{Number(activeScanMetadata.lat).toFixed(4)}, {Number(activeScanMetadata.lon).toFixed(4)}].
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={recenterOnActiveScan}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "0.38rem 0.85rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <LocationPinIcon size={14} color="#ffffff" />
              <span>Center Map Here</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Controls & Filter Bar ─────────────────────────────────── */}
      <div className="spatial-controls-card" style={{
        background: "var(--card-bg, #ffffff)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: "12px",
        padding: "0.85rem 1.1rem",
        marginBottom: "1rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.9rem",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        {/* Mode Selector: Hotspots vs Individual Points */}
        <div style={{ display: "flex", alignItems: "center", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
          <button
            type="button"
            onClick={() => setViewMode("hotspots")}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "6px",
              fontSize: "0.82rem",
              fontWeight: viewMode === "hotspots" ? 700 : 500,
              background: viewMode === "hotspots" ? "#ffffff" : "transparent",
              color: viewMode === "hotspots" ? "#dc2626" : "#64748b",
              border: "none",
              boxShadow: viewMode === "hotspots" ? "0 2px 4px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <FlameIcon size={14} color="#dc2626" />
            <span>Outbreak Hotspots ({hotspots.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("observations")}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "6px",
              fontSize: "0.82rem",
              fontWeight: viewMode === "observations" ? 700 : 500,
              background: viewMode === "observations" ? "#ffffff" : "transparent",
              color: viewMode === "observations" ? "#2563eb" : "#64748b",
              border: "none",
              boxShadow: viewMode === "observations" ? "0 2px 4px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <MapIcon size={14} color="#2563eb" />
            <span>Anonymized Reports ({rawReports.length})</span>
          </button>
        </div>

        {/* Channel Filter: Disease vs Pest vs All */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            style={{
              padding: "0.32rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.82rem",
              fontWeight: categoryFilter === "all" ? 700 : 500,
              background: categoryFilter === "all" ? "rgba(16,185,129,0.15)" : "#ffffff",
              color: categoryFilter === "all" ? "#047857" : "#64748b",
              border: categoryFilter === "all" ? "1.5px solid #10b981" : "1px solid #cbd5e1",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <MapIcon size={13} color="#047857" />
            <span>All Outbreaks</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("disease")}
            style={{
              padding: "0.32rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.82rem",
              fontWeight: categoryFilter === "disease" ? 700 : 500,
              background: categoryFilter === "disease" ? "rgba(239,68,68,0.12)" : "#ffffff",
              color: categoryFilter === "disease" ? "#dc2626" : "#64748b",
              border: categoryFilter === "disease" ? "1.5px solid #ef4444" : "1px solid #cbd5e1",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <LeafIcon size={13} color="#dc2626" />
            <span>Disease Hotspots</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("pest")}
            style={{
              padding: "0.32rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.82rem",
              fontWeight: categoryFilter === "pest" ? 700 : 500,
              background: categoryFilter === "pest" ? "rgba(139,92,246,0.15)" : "#ffffff",
              color: categoryFilter === "pest" ? "#7c3aed" : "#64748b",
              border: categoryFilter === "pest" ? "1.5px solid #8b5cf6" : "1px solid #cbd5e1",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <PestIcon size={13} color="#7c3aed" />
            <span>Pest Hotspots</span>
          </button>
        </div>

        {/* Location Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <LocationPinIcon size={14} color="var(--primary)" />
            <span>Your Location:</span>
          </span>
          <select
            className="form-input"
            style={{ width: "auto", padding: "0.32rem 0.7rem", fontSize: "0.82rem", fontWeight: 600 }}
            value={farmerLocName.includes("Nashik") ? "nashik" : farmerLocName.includes("Pune") ? "pune" : farmerLocName.includes("Solapur") ? "solapur" : farmerLocName.includes("Ahmednagar") ? "ahmednagar" : "sangli"}
            onChange={(e) => handleLocationPreset(e.target.value)}
          >
            <option value="sangli">Sangli (Miraj / Tasgaon)</option>
            <option value="nashik">Nashik (Pimpalgaon / Ozar)</option>
            <option value="solapur">Solapur (Pandharpur Belt)</option>
            <option value="ahmednagar">Ahmednagar (Rahuri Belt)</option>
            <option value="pune">Pune (Baramati Belt)</option>
          </select>
          {onNavigateToExpert && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onNavigateToExpert}
              style={{
                padding: "0.32rem 0.8rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "#7e22ce",
                background: "rgba(147,51,234,0.08)",
                border: "1.5px solid #a855f7",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer"
              }}
            >
              <ExpertIcon size={14} color="#7e22ce" />
              <span>Expert Validation Hub</span>
              <ArrowRightIcon size={12} color="#7e22ce" />
            </button>
          )}
        </div>
      </div>

      {/* ── 4. Main Spatial Workspace Grid ───────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 370px", gap: "1.25rem", alignItems: "start" }}>
        
        {/* Left: Leaflet Interactive Map Container */}
        <div style={{ position: "relative" }}>
          <div
            ref={mapContainerRef}
            style={{
              width: "100%",
              height: "620px",
              borderRadius: "14px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              border: "1px solid var(--border, #cbd5e1)",
              zIndex: 1
            }}
          />

          {/* Floating Map Legend Overlay */}
          <div style={{
            position: "absolute",
            bottom: "22px",
            left: "22px",
            zIndex: 1000,
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(6px)",
            padding: "0.75rem 0.95rem",
            borderRadius: "10px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: "0.78rem",
            maxWidth: "240px",
            border: "1px solid #e2e8f0"
          }}>
            <strong style={{ color: "#1e293b", display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
              {viewMode === "hotspots" ? (
                <><FlameIcon size={14} color="#ea580c" /> PostGIS Hotspot Legend</>
              ) : (
                <><LocationPinIcon size={14} color="#059669" /> Field Reports Legend</>
              )}
            </strong>
            {viewMode === "hotspots" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#dc2626", border: "2px solid #ef4444" }}></span>
                  <span>Critical Outbreak Zone (&gt;= 4 cases)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ea580c", border: "2px solid #f97316" }}></span>
                  <span>Emerging Hotspot (2-3 cases)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ca8a04", border: "2px solid #eab308" }}></span>
                  <span>Sporadic Detection (1 case)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#2563eb", border: "2px solid #3b82f6" }}></span>
                  <span>Your Farm Beacon (PostGIS Origin)</span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }}></span>
                  <span>Critical / Severe Infection</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#eab308" }}></span>
                  <span>Moderate Infection</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#8b5cf6" }}></span>
                  <span>Pest Trap Infestation</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Side Intelligence Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* A. Proximity & Outbreak Radar Card */}
          <div style={{
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "14px",
            padding: "1rem 1.15rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}>
                <ShieldIcon size={18} color="#dc2626" />
                <span>Epidemiological Threat Radar</span>
              </h3>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563eb", background: "#eff6ff", padding: "2px 7px", borderRadius: "4px" }}>
                {farmerLocName.split(",")[0]}
              </span>
            </div>

            {/* Radar Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.85rem" }}>
              <div style={{ background: "#f8fafc", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.74rem", color: "#64748b", display: "block" }}>TOTAL HOTSPOTS</span>
                <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e293b" }}>
                  {hotspotAnalytics?.totalHotspots || hotspots.length}
                </span>
              </div>
              <div style={{ background: "#fef2f2", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid #fecaca" }}>
                <span style={{ fontSize: "0.74rem", color: "#b91c1c", display: "block" }}>CRITICAL ZONES</span>
                <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#dc2626" }}>
                  {hotspotAnalytics?.criticalCount || 0}
                </span>
              </div>
            </div>

            {/* Closest Threat Distance Alert */}
            {spatialSummary?.closestThreatKm !== null && spatialSummary?.closestThreatKm !== undefined && (
              <div style={{
                background: spatialSummary.closestThreatKm < 5 ? "#fff1f2" : "#f0fdf4",
                border: `1px solid ${spatialSummary.closestThreatKm < 5 ? "#fecdd3" : "#bbf7d0"}`,
                borderRadius: "8px",
                padding: "0.65rem 0.85rem",
                fontSize: "0.82rem",
                color: spatialSummary.closestThreatKm < 5 ? "#be123c" : "#166534",
                lineHeight: 1.45
              }}>
                <strong>
                  {spatialSummary.closestThreatKm < 5 ? "Immediate Threat Proximity:" : "Nearest Outbreak Distance:"}
                </strong>{" "}
                Active condition detected within <strong>{spatialSummary.closestThreatKm} km</strong> of your farm coordinates.
              </div>
            )}
          </div>

          {/* B. Active Outbreak Hotspots Directory */}
          <div style={{
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "14px",
            padding: "1rem 1.15rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#1e293b" }}>
                Active Hotspot Clusters ({hotspots.length})
              </h4>
              <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                PostGIS Aggregated
              </span>
            </div>

            <div style={{ maxHeight: "380px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {hotspots.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                  No active outbreak clusters detected for this filter.
                </div>
              ) : (
                hotspots.map((hs) => {
                  const risk = RISK_COLORS[hs.riskLevel] || RISK_COLORS.EMERGING_HOTSPOT;
                  const isSelected = selectedHotspot?.hotspotId === hs.hotspotId;

                  return (
                    <div
                      key={hs.hotspotId}
                      onClick={() => focusHotspotOnMap(hs)}
                      style={{
                        padding: "0.75rem 0.85rem",
                        borderRadius: "10px",
                        border: isSelected ? `2px solid ${risk.primary}` : "1px solid #e2e8f0",
                        background: isSelected ? risk.bg : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3px" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 800, background: risk.pillBg, color: risk.pillText, padding: "2px 6px", borderRadius: "4px" }}>
                          {risk.badge}
                        </span>
                        {hs.distanceFromUserKm !== null && (
                          <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#2563eb" }}>
                            {hs.distanceFromUserKm} km away
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 800, fontSize: "0.94rem", color: "#0f172a", marginBottom: "2px" }}>
                        {hs.conditionName}
                      </div>

                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "6px" }}>
                        Crop: <strong>{hs.crop || "Crop"}</strong> · {(hs.affectedVillages || []).slice(0, 2).join(", ") || "Cluster Zone"}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.74rem" }}>
                        <span style={{ color: "#334155", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FlameIcon size={12} color="#dc2626" />
                          <span>{hs.totalCases || 1} Reports ({hs.radiusKm || 5}km radius)</span>
                        </span>
                        <span style={{ color: (hs.trend || "").includes("Surging") ? "#dc2626" : "#475569", fontWeight: 700 }}>
                          {hs.trend || "Active ➡️"}
                        </span>
                      </div>

                      {userRole === "officer" && (
                        <div style={{ marginTop: "6px", paddingTop: "5px", borderTop: "1px dashed #e2e8f0", fontSize: "0.72rem", color: "#1e40af", display: "flex", alignItems: "center", gap: "4px" }}>
                          <BuildingIcon size={12} />
                          <span><strong>Officer:</strong> {hs.officerAction}</span>
                        </div>
                      )}

                      {onNavigateToExpert && (
                        <div style={{ marginTop: "6px", paddingTop: "5px", borderTop: "1px dashed #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.72rem", color: "#64748b", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <ExpertIcon size={12} color="#7e22ce" />
                            <span>Agronomist Review:</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToExpert();
                            }}
                            style={{
                              background: "rgba(147,51,234,0.08)",
                              color: "#7e22ce",
                              border: "1px solid #c084fc",
                              padding: "3px 8px",
                              borderRadius: "4px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <ExpertIcon size={12} color="#7e22ce" />
                            <span>Verify Cluster Cases</span>
                            <ArrowRightIcon size={10} color="#7e22ce" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── 5. Technical Architecture Modal ──────────────────────────── */}
      {showArchModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            maxWidth: "720px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "1.75rem",
            boxShadow: "0 20px 40px rgba(0,0,0,0.25)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <LayersIcon size={20} color="#0284c7" />
                <span>PostGIS Geospatial Hotspot Architecture</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowArchModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <div style={{ fontSize: "0.86rem", color: "#334155", lineHeight: 1.6 }}>
              <p>
                The Agri-AI spatial pipeline ingests field diagnosis reports, strictly preserves farmer privacy, and executes high-performance DBSCAN spatial clustering in PostgreSQL:
              </p>

              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "1rem",
                fontFamily: "monospace",
                fontSize: "0.82rem",
                lineHeight: 1.5,
                color: "#1e293b",
                marginBottom: "1rem"
              }}>
                FIELD REPORTS (Image Analysis / Trap Scans)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│<br/>
                ┌──────┴──────┐<br/>
                ↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br/>
                DISEASE CASES&nbsp;&nbsp;PEST CASES<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br/>
                Location + Time (PostgreSQL + PostGIS GiST Index)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──────┬──────┘<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br/>
                POSTGIS DBSCAN SPATIAL AGGREGATION<br/>
                (ST_ClusterDBSCAN + ST_Centroid + ST_Distance)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;┌──────┴──────┐<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br/>
                Disease Hotspots&nbsp;Pest Hotspots<br/>
                (Case Count + Trend + Radius Buffer)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──────┬──────┘<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br/>
                LEAFLET MAP &amp; FARMER/OFFICER DASHBOARD
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.82rem" }}>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "8px", color: "#166534" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <LockIcon size={14} color="#166534" />
                    <strong>Privacy Protection:</strong>
                  </div>
                  Zero personally identifiable information (names/phones) is returned in the API or rendered on the map. Individual points are generalized into geographic epidemiology zones.
                </div>
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.75rem", borderRadius: "8px", color: "#1e40af" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <LayersIcon size={14} color="#1e40af" />
                    <strong>PostGIS Indexing:</strong>
                  </div>
                  GiST spatial index (<code>idx_spatial_reports_geom</code>) allows sub-5ms proximity radius queries (<code>ST_DWithin</code>) across millions of historical agricultural scans.
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.25rem", textAlign: "right" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowArchModal(false)}
                style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
              >
                Close Architecture View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
