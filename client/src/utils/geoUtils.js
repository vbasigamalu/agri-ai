/**
 * Geospatial Utilities for Agri-AI GIS Outbreak Mapping
 * Synchronizes field locations between Disease / Pest image upload tabs and the GIS Outbreak Map.
 */

export const MAHARASHTRA_DISTRICTS = {
  sangli: { lat: 16.8524, lon: 74.5815, name: "Sangli, Maharashtra" },
  nashik: { lat: 20.0059, lon: 73.7898, name: "Nashik, Maharashtra" },
  pune: { lat: 18.5204, lon: 73.8567, name: "Pune, Maharashtra" },
  solapur: { lat: 17.6599, lon: 75.9064, name: "Solapur, Maharashtra" },
  ahmednagar: { lat: 19.0952, lon: 74.7496, name: "Ahmednagar, Maharashtra" },
  kolhapur: { lat: 16.7050, lon: 74.2433, name: "Kolhapur, Maharashtra" },
  satara: { lat: 17.6805, lon: 74.0183, name: "Satara, Maharashtra" },
  jalgaon: { lat: 21.0077, lon: 75.5626, name: "Jalgaon, Maharashtra" },
  aurangabad: { lat: 19.8762, lon: 75.3433, name: "Chhatrapati Sambhajinagar, Maharashtra" },
  nagpur: { lat: 21.1458, lon: 79.0882, name: "Nagpur, Maharashtra" },
  amravati: { lat: 20.9374, lon: 77.7796, name: "Amravati, Maharashtra" }
};

export const ACTIVE_SCAN_STORAGE_KEY = "agri_active_scan_location";

/**
 * Resolve the initial field location for a user or current session.
 */
export function resolveInitialLocation(user = null) {
  // 1. Check for recent active scan in localStorage
  try {
    const saved = localStorage.getItem(ACTIVE_SCAN_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.lat && parsed?.lon) {
        return {
          lat: parseFloat(parsed.lat),
          lon: parseFloat(parsed.lon),
          locationName: parsed.locationName || "Scanned Field Location",
          source: "Saved Scan",
          activeScan: parsed
        };
      }
    }
  } catch (e) {
    console.warn("Could not read saved scan location:", e);
  }

  // 2. Check user profile district
  const distKey = (user?.district || "").trim().toLowerCase();
  for (const [key, d] of Object.entries(MAHARASHTRA_DISTRICTS)) {
    if (distKey.includes(key)) {
      return {
        lat: d.lat,
        lon: d.lon,
        locationName: d.name,
        source: "User Profile District",
        activeScan: null
      };
    }
  }

  // 3. Fallback: Agricultural Epicenter (Sangli, Maharashtra)
  return {
    lat: 16.8524,
    lon: 74.5815,
    locationName: user?.district ? `${user.district}, Maharashtra` : "Sangli, Maharashtra",
    source: "Default Agricultural Center",
    activeScan: null
  };
}

/**
 * Persist active scan location to localStorage
 */
export function saveActiveScanLocation(data) {
  if (!data?.lat || !data?.lon) return null;
  const payload = {
    lat: parseFloat(data.lat),
    lon: parseFloat(data.lon),
    locationName: data.locationName || "Scanned Field Location",
    crop: data.crop || "Crop",
    condition: data.condition || data.disease || data.pest || "Diagnosis",
    category: data.category || "disease", // 'disease' | 'pest'
    severity: data.severity || "Moderate",
    confidence: data.confidence || 0.9,
    timestamp: data.timestamp || new Date().toISOString()
  };
  try {
    localStorage.setItem(ACTIVE_SCAN_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not write active scan location:", e);
  }
  return payload;
}

/**
 * Get active scan location safely
 */
export function getActiveScanLocation() {
  try {
    const raw = localStorage.getItem(ACTIVE_SCAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
