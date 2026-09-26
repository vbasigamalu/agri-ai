const express = require("express");
const router = express.Router();
const {
    recordSpatialReport,
    getNearbyReports,
    getReportsGeoJson,
    getSpatialSummary,
    getHotspots
} = require("../spatial");

/**
 * GET /api/spatial/nearby
 * Returns outbreaks within a spatial radius using PostGIS ST_DWithin & ST_Distance
 * Query params: lat, lon, radiusKm (default 25), type, severity, limit
 */
router.get("/nearby", async (req, res) => {
    try {
        const { lat, lon, radiusKm = 25, type = "all", severity = "all", limit = 100 } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({
                error: "Coordinates 'lat' and 'lon' are required for spatial proximity search."
            });
        }

        const reports = await getNearbyReports({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            radiusKm: parseFloat(radiusKm),
            type,
            severity,
            limit: parseInt(limit, 10)
        });

        return res.json({
            success: true,
            center: { lat: parseFloat(lat), lon: parseFloat(lon) },
            radiusKm: parseFloat(radiusKm),
            count: reports.length,
            reports
        });
    } catch (err) {
        console.error("Spatial Nearby Error:", err.message);
        return res.status(500).json({ error: err.message || "Failed to retrieve nearby spatial reports." });
    }
});

/**
 * GET /api/spatial/geojson
 * Returns PostGIS GeoJSON FeatureCollection stream for Leaflet map
 * Query params: type, severity, days, limit
 */
router.get("/geojson", async (req, res) => {
    try {
        const { type = "all", severity = "all", days = 60, limit = 250 } = req.query;

        const geojson = await getReportsGeoJson({
            type,
            severity,
            days: parseInt(days, 10),
            limit: parseInt(limit, 10)
        });

        return res.json(geojson);
    } catch (err) {
        console.error("Spatial GeoJSON Error:", err.message);
        return res.status(500).json({ error: err.message || "Failed to generate GeoJSON feature collection." });
    }
});

/**
 * GET /api/spatial/summary
 * Returns high-level spatial risk summary around user's coordinates
 * Query params: lat, lon, radiusKm
 */
router.get("/summary", async (req, res) => {
    try {
        const { lat, lon, radiusKm = 25 } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ error: "Coordinates 'lat' and 'lon' are required." });
        }

        const summary = await getSpatialSummary({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            radiusKm: parseFloat(radiusKm)
        });

        return res.json({ success: true, summary });
    } catch (err) {
        console.error("Spatial Summary Error:", err.message);
        return res.status(500).json({ error: err.message || "Failed to calculate spatial risk summary." });
    }
});

/**
 * GET /api/spatial/hotspots
 * PostGIS ST_ClusterDBSCAN Outbreak Aggregation Engine
 * Returns spatial clusters for Disease and Pest hotspots, risk classifications, and trends.
 * STRICT PRIVACY: Zero personal farmer identity is returned.
 * Query params: category ('all'|'disease'|'pest'), days, district, lat, lon
 */
router.get("/hotspots", async (req, res) => {
    try {
        const { category = "all", days = 45, district = null, lat = null, lon = null } = req.query;

        const { hotspots, analytics } = await getHotspots({
            category,
            days: parseInt(days, 10),
            district: district || null,
            userLat: lat ? parseFloat(lat) : null,
            userLon: lon ? parseFloat(lon) : null
        });

        return res.json({
            success: true,
            filter: { category, days: parseInt(days, 10), district: district || "All" },
            analytics,
            count: hotspots.length,
            hotspots
        });
    } catch (err) {
        console.error("Spatial Hotspots Error:", err.message);
        return res.status(500).json({ error: err.message || "Failed to compute geospatial hotspots." });
    }
});

/**
 * POST /api/spatial/report
 * Create a new spatial outbreak report (from field scan or pest trap)
 */
router.post("/report", async (req, res) => {
    try {
        const {
            farmerName,
            reportType,
            crop,
            disease,
            pest,
            severity,
            confidence,
            latitude,
            longitude,
            district,
            village,
            weatherTemp,
            weatherHumidity,
            spray,
            notes
        } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: "Coordinates 'latitude' and 'longitude' are required." });
        }

        const newReport = await recordSpatialReport({
            farmerId: req.user?.id || null,
            farmerName: farmerName || req.user?.name || "Farmer",
            reportType: reportType || "disease",
            crop: crop || "Crop",
            disease: disease || null,
            pest: pest || null,
            severity: severity || "Moderate",
            confidence: confidence ? parseFloat(confidence) : 0.9,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            district: district || "",
            village: village || "",
            weatherTemp: weatherTemp ? parseFloat(weatherTemp) : null,
            weatherHumidity: weatherHumidity ? parseFloat(weatherHumidity) : null,
            spray: spray || "N/A",
            notes: notes || ""
        });

        return res.status(201).json({
            success: true,
            message: "Spatial report successfully recorded in PostGIS database.",
            report: newReport
        });
    } catch (err) {
        console.error("Record Spatial Report Error:", err.message);
        return res.status(500).json({ error: err.message || "Failed to record spatial report." });
    }
});

module.exports = router;
