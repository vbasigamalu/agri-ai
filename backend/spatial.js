/**
 * =============================================================================
 * Agri-AI PostGIS Geospatial Service & Hotspot Aggregation Engine
 * =============================================================================
 * Provides:
 * 1. PostGIS spatial indexing (GiST) & triggers.
 * 2. Spatial Aggregation & DBSCAN Clustering (ST_ClusterDBSCAN) for Disease & Pest Hotspots.
 * 3. Hotspot Intensity, Risk Classification (Critical, Emerging, Sporadic), and Trend Analysis.
 * 4. STRICT PRIVACY: Zero farmer personal identities are exposed to public maps or APIs.
 * =============================================================================
 */

const { query } = require("./postgres");

/**
 * Initialize PostGIS extension, spatial tables, indexes, and triggers
 */
async function initSpatialDB() {
    try {
        console.log("🗺️  Initializing PostGIS Geospatial Subsystem...");

        // 1. Enable PostGIS
        await query("CREATE EXTENSION IF NOT EXISTS postgis;");

        // 2. Create spatial_reports table
        await query(`
            CREATE TABLE IF NOT EXISTS spatial_reports (
                id SERIAL PRIMARY KEY,
                farmer_id INT REFERENCES users(id) ON DELETE SET NULL,
                farmer_name VARCHAR(100) DEFAULT 'Farmer',
                report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('disease', 'pest')),
                crop VARCHAR(100) NOT NULL,
                disease VARCHAR(100),
                pest VARCHAR(100),
                severity VARCHAR(30) DEFAULT 'Moderate',
                confidence FLOAT DEFAULT 0.85,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                geom GEOMETRY(Point, 4326),
                district VARCHAR(100),
                village VARCHAR(100),
                weather_temp FLOAT,
                weather_humidity FLOAT,
                spray VARCHAR(200),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Create GiST Spatial Index on geom column
        await query(`
            CREATE INDEX IF NOT EXISTS idx_spatial_reports_geom 
            ON spatial_reports USING GIST (geom);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_spatial_reports_time 
            ON spatial_reports (created_at DESC);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_spatial_reports_type 
            ON spatial_reports (report_type);
        `);

        // 4. Trigger to ensure geom is ALWAYS populated from latitude and longitude
        await query(`
            CREATE OR REPLACE FUNCTION update_spatial_geom()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
                    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await query(`
            DROP TRIGGER IF EXISTS trg_spatial_geom ON spatial_reports;
            CREATE TRIGGER trg_spatial_geom
            BEFORE INSERT OR UPDATE OF latitude, longitude ON spatial_reports
            FOR EACH ROW
            EXECUTE FUNCTION update_spatial_geom();
        `);

        // 5. Ensure column widths can accommodate detailed diagnostic descriptions
        try {
            await query("ALTER TABLE spatial_reports ALTER COLUMN severity TYPE VARCHAR(150);");
            await query("ALTER TABLE spatial_reports ALTER COLUMN disease TYPE VARCHAR(255);");
            await query("ALTER TABLE spatial_reports ALTER COLUMN pest TYPE VARCHAR(255);");
            await query("ALTER TABLE spatial_reports ALTER COLUMN spray TYPE TEXT;");
            await query("ALTER TABLE spatial_reports ALTER COLUMN crop TYPE VARCHAR(150);");
            await query("ALTER TABLE spatial_reports ALTER COLUMN village TYPE VARCHAR(200);");
            await query("ALTER TABLE spatial_reports ALTER COLUMN district TYPE VARCHAR(200);");
        } catch (migErr) {
            // Already widened
        }

        console.log("   ✅ PostGIS [spatial_reports] table & GiST spatial index verified!");

        // 5. Seed realistic hotspot clusters across Maharashtra
        await seedHotspotClustersIfSparse();

    } catch (err) {
        console.warn("⚠️  PostGIS Initialization Notice:", err.message);
    }
}

/**
 * Seed realistic multi-case clusters across Maharashtra agricultural zones
 * to demonstrate PostGIS DBSCAN spatial aggregation, disease trends, and hotspots.
 */
async function seedHotspotClustersIfSparse() {
    try {
        const countRes = await query("SELECT COUNT(*) FROM spatial_reports;");
        const count = parseInt(countRes.rows[0].count, 10);
        if (count >= 20) return;

        console.log("🌱 Seeding realistic Maharashtra agricultural hotspot clusters...");

        const sampleReports = [
            // =========================================================================
            // CLUSTER 1: Sangli Tomato Early Blight Outbreak (5 clustered cases)
            // =========================================================================
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Tomato",
                disease: "Early Blight",
                pest: null,
                severity: "Critical",
                confidence: 0.94,
                latitude: 16.8524,
                longitude: 74.5815,
                district: "Sangli",
                village: "Miraj Rural",
                weather_temp: 27.5,
                weather_humidity: 84,
                spray: "Chlorothalonil 75% WP @ 2.0g/L or Mancozeb 75% WP @ 2.5g/L",
                notes: "Rapid lesion spread on lower tomato foliage after damp morning mist."
            },
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Tomato",
                disease: "Early Blight",
                pest: null,
                severity: "Severe",
                confidence: 0.91,
                latitude: 16.8610,
                longitude: 74.6020,
                district: "Sangli",
                village: "Kupwad",
                weather_temp: 28.0,
                weather_humidity: 80,
                spray: "Chlorothalonil 75% WP @ 2.0g/L",
                notes: "Target-board circular spots with concentric chlorotic rings."
            },
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Tomato",
                disease: "Early Blight",
                pest: null,
                severity: "Severe",
                confidence: 0.89,
                latitude: 16.8540,
                longitude: 74.5900,
                district: "Sangli",
                village: "Vishrambag",
                weather_temp: 27.0,
                weather_humidity: 82,
                spray: "Chlorothalonil 75% WP @ 2.0g/L",
                notes: "Early defoliation detected in 3-acre parcel."
            },
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Tomato",
                disease: "Early Blight",
                pest: null,
                severity: "Moderate",
                confidence: 0.87,
                latitude: 16.8420,
                longitude: 74.6310,
                district: "Sangli",
                village: "Miraj MIDC Border",
                weather_temp: 28.5,
                weather_humidity: 76,
                spray: "Chlorothalonil 75% WP @ 2.0g/L",
                notes: "Brown patches on lower leaves, spread arrested with first spray."
            },
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Tomato",
                disease: "Early Blight",
                pest: null,
                severity: "Moderate",
                confidence: 0.85,
                latitude: 16.8730,
                longitude: 74.5720,
                district: "Sangli",
                village: "Sangli Gaon",
                weather_temp: 29.0,
                weather_humidity: 73,
                spray: "Mancozeb 75% WP @ 2.5g/L",
                notes: "Isolated lower leaf infection detected via mobile scan."
            },

            // =========================================================================
            // CLUSTER 2: Tasgaon Grape Thrips Pest Outbreak (4 clustered cases)
            // =========================================================================
            {
                farmer_name: "Farmer",
                report_type: "pest",
                crop: "Grapes",
                disease: null,
                pest: "Thrips Infestation",
                severity: "Critical",
                confidence: 0.95,
                latitude: 17.0340,
                longitude: 74.6020,
                district: "Sangli",
                village: "Tasgaon Central",
                weather_temp: 32.0,
                weather_humidity: 52,
                spray: "Fipronil 5% SC @ 1.5ml/L or Spinetoram 11.7% SC @ 0.9ml/L",
                notes: "Blue sticky trap count: 52 thrips/card. Severe shoot scarring."
            },
            {
                farmer_name: "Farmer",
                report_type: "pest",
                crop: "Grapes",
                disease: null,
                pest: "Thrips Infestation",
                severity: "Severe",
                confidence: 0.90,
                latitude: 17.0120,
                longitude: 74.6300,
                district: "Sangli",
                village: "Manerajuri",
                weather_temp: 31.5,
                weather_humidity: 55,
                spray: "Fipronil 5% SC @ 1.5ml/L",
                notes: "Corky scab scarring on developing grape berry bunches."
            },
            {
                farmer_name: "Farmer",
                report_type: "pest",
                crop: "Grapes",
                disease: null,
                pest: "Thrips Infestation",
                severity: "Severe",
                confidence: 0.88,
                latitude: 17.0510,
                longitude: 74.6450,
                district: "Sangli",
                village: "Savlaj",
                weather_temp: 31.0,
                weather_humidity: 58,
                spray: "Imidacloprid 17.8% SL @ 0.5ml/L",
                notes: "Foliar curling upwards with silvery leaf sheen."
            },
            {
                farmer_name: "Farmer",
                report_type: "pest",
                crop: "Grapes",
                disease: null,
                pest: "Thrips Infestation",
                severity: "Moderate",
                confidence: 0.86,
                latitude: 17.0250,
                longitude: 74.5820,
                district: "Sangli",
                village: "Tasgaon West",
                weather_temp: 32.5,
                weather_humidity: 50,
                spray: "Neem Oil 10,000 ppm @ 3ml/L",
                notes: "Pre-bloom cluster scan detected initial nymph activity."
            },

            // =========================================================================
            // CLUSTER 3: Nashik Tomato Fruit Borer Pest Outbreak (4 clustered cases)
            // =========================================================================
            {
                farmer_name: "Farmer",
                report_type: "pest",
                crop: "Tomato",
                disease: null,
                pest: "Tomato Fruit Borer (Helicoverpa)",
                severity: "Critical",
                confidence: 0.96,
                latitude: 20.1650,
                longitude: 73.9940,
                district: "Nashik",
                village: "Pimpalgaon Baswant",
                weather_temp: 27.0,
                weather_humidity: 68,
                spray: "Chlorantraniliprole 18.5% SC @ 0.3ml/L",
                notes: "Pheromone traps recorded 18 adult moths/night. Larvae boring into green fruit."
            },
            {
                farmer_name: "Farmer",
                report_type: "pest",
                crop: "Tomato",
                disease: null,
                pest: "Tomato Fruit Borer (Helicoverpa)",
                severity: "Severe",
                confidence: 0.92,
                latitude: 20.0920,
                longitude: 73.9220,
                district: "Nashik",
                village: "Ozar",
                weather_temp: 26.5,
                weather_humidity: 70,
                spray: "Flubendiamide 39.35% SC @ 0.25ml/L",
                notes: "Circular entry holes in 15% of sampled fruit."
            },
            {
                farmer_name: "Farmer",
                report_type: "pest",
                crop: "Tomato",
                disease: null,
                pest: "Tomato Fruit Borer (Helicoverpa)",
                severity: "Severe",
                confidence: 0.89,
                latitude: 20.2010,
                longitude: 73.8340,
                district: "Nashik",
                village: "Dindori",
                weather_temp: 25.5,
                weather_humidity: 72,
                spray: "Chlorantraniliprole 18.5% SC @ 0.3ml/L",
                notes: "Egg clusters noticed on calyx and young foliage."
            },
            {
                farmer_name: "Farmer",
                report_type: "pest",
                crop: "Tomato",
                disease: null,
                pest: "Tomato Fruit Borer (Helicoverpa)",
                severity: "Moderate",
                confidence: 0.87,
                latitude: 20.0780,
                longitude: 74.1090,
                district: "Nashik",
                village: "Niphad",
                weather_temp: 27.5,
                weather_humidity: 65,
                spray: "Emamectin Benzoate 5% SG @ 0.4g/L",
                notes: "Field perimeter scan revealed second instar larvae."
            },

            // =========================================================================
            // CLUSTER 4: Solapur Pomegranate Bacterial Blight Telya (3 clustered cases)
            // =========================================================================
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Pomegranate",
                disease: "Bacterial Blight (Telya)",
                pest: null,
                severity: "Critical",
                confidence: 0.96,
                latitude: 17.6780,
                longitude: 75.3250,
                district: "Solapur",
                village: "Pandharpur",
                weather_temp: 33.0,
                weather_humidity: 48,
                spray: "Bordeaux Mixture 1% or Copper Hydroxide 53.8% DF @ 2.0g/L + Streptocycline 0.25g/L",
                notes: "Oily angular spots turning black on leaves with fruit rind cracking."
            },
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Pomegranate",
                disease: "Bacterial Blight (Telya)",
                pest: null,
                severity: "Severe",
                confidence: 0.91,
                latitude: 17.5110,
                longitude: 75.4520,
                district: "Solapur",
                village: "Mangalwedha",
                weather_temp: 34.0,
                weather_humidity: 45,
                spray: "Copper Hydroxide 53.8% DF @ 2.0g/L",
                notes: "Severe nodal stem cankers and fruit 'L'/'Y' cracks."
            },
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Pomegranate",
                disease: "Bacterial Blight (Telya)",
                pest: null,
                severity: "Moderate",
                confidence: 0.88,
                latitude: 17.7800,
                longitude: 75.2900,
                district: "Solapur",
                village: "Karkamb",
                weather_temp: 32.5,
                weather_humidity: 50,
                spray: "Bordeaux Mixture 1%",
                notes: "Water-soaked greasy lesions restricted to outer foliage."
            },

            // =========================================================================
            // CLUSTER 5: Ahmednagar Soybean Yellow Mosaic Virus (3 clustered cases)
            // =========================================================================
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Soybean",
                disease: "Yellow Mosaic Virus",
                pest: null,
                severity: "Critical",
                confidence: 0.93,
                latitude: 19.3952,
                longitude: 74.6496,
                district: "Ahmednagar",
                village: "Rahuri",
                weather_temp: 31.0,
                weather_humidity: 55,
                spray: "Vector Whitefly control: Thiamethoxam 25% WG @ 0.5g/L or Acetamiprid 20% SP @ 0.3g/L",
                notes: "Widespread bright yellow chlorotic patches across 5-acre field. Vector whiteflies rampant."
            },
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Soybean",
                disease: "Yellow Mosaic Virus",
                pest: null,
                severity: "Severe",
                confidence: 0.90,
                latitude: 19.6190,
                longitude: 74.6590,
                district: "Ahmednagar",
                village: "Shrirampur",
                weather_temp: 30.5,
                weather_humidity: 58,
                spray: "Thiamethoxam 25% WG @ 0.5g/L",
                notes: "Stunted growth and mottled golden leaves."
            },
            {
                farmer_name: "Farmer",
                report_type: "disease",
                crop: "Soybean",
                disease: "Yellow Mosaic Virus",
                pest: null,
                severity: "Moderate",
                confidence: 0.86,
                latitude: 19.5500,
                longitude: 74.9200,
                district: "Ahmednagar",
                village: "Newasa",
                weather_temp: 31.5,
                weather_humidity: 52,
                spray: "Neem Oil 10,000 ppm @ 2.5ml/L + Yellow Sticky Traps",
                notes: "Initial yellowing along veins on upper trifoliate leaves."
            }
        ];

        for (const r of sampleReports) {
            await query(`
                INSERT INTO spatial_reports (
                    farmer_name, report_type, crop, disease, pest,
                    severity, confidence, latitude, longitude,
                    district, village, weather_temp, weather_humidity,
                    spray, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
            `, [
                r.farmer_name, r.report_type, r.crop, r.disease, r.pest,
                r.severity, r.confidence, r.latitude, r.longitude,
                r.district, r.village, r.weather_temp, r.weather_humidity,
                r.spray, r.notes
            ]);
        }

        console.log(`   ✅ Successfully seeded ${sampleReports.length} spatial reports forming 5 distinct Maharashtra outbreak clusters!`);
    } catch (e) {
        console.warn("⚠️  Hotspot Seeding Notice:", e.message);
    }
}

/**
 * Record a new spatial report (from Disease Detection scan or Pest Trap monitor).
 * Automatically associates PostGIS geometry with SRID 4326.
 */
async function recordSpatialReport({
    farmerId = null,
    farmerName = "Farmer",
    reportType = "disease",
    crop,
    disease = null,
    pest = null,
    severity = "Moderate",
    confidence = 0.9,
    latitude,
    longitude,
    district = "",
    village = "",
    weatherTemp = null,
    weatherHumidity = null,
    spray = "N/A",
    notes = ""
}) {
    if (!latitude || !longitude) {
        throw new Error("Latitude and longitude are mandatory for PostGIS spatial reports");
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // Normalize severity to standard category
    let normSeverity = "Moderate";
    const s = String(severity || "").toLowerCase();
    if (s.includes("critical")) normSeverity = "Critical";
    else if (s.includes("severe")) normSeverity = "Severe";
    else if (s.includes("low") || s.includes("mild")) normSeverity = "Low";
    else normSeverity = "Moderate";

    const res = await query(`
        INSERT INTO spatial_reports (
            farmer_id, farmer_name, report_type, crop, disease, pest,
            severity, confidence, latitude, longitude,
            district, village, weather_temp, weather_humidity,
            spray, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, report_type, crop, disease, pest, severity, confidence, latitude, longitude, created_at;
    `, [
        farmerId, farmerName, reportType, crop || "Crop", disease, pest,
        normSeverity, confidence, lat, lon,
        district, village, weatherTemp, weatherHumidity,
        spray, notes
    ]);

    return res.rows[0];
}

/**
 * =============================================================================
 * PostGIS Spatial Hotspot Aggregation Engine (ST_ClusterDBSCAN)
 * =============================================================================
 * Aggregates nearby disease/pest cases into geographic outbreak zones.
 * Computes:
 * - Cluster Centroid (ST_Centroid)
 * - Hotspot Spread Radius (ST_Distance buffer)
 * - Risk Classification (Critical, Emerging, Sporadic)
 * - Spread Trend (Surging, Active, Contained)
 * - STRICT PRIVACY: Zero farmer personal identities are exposed.
 * =============================================================================
 */
async function getHotspots({
    category = "all", // 'all', 'disease', or 'pest'
    days = 45,
    district = null,
    userLat = null,
    userLon = null,
    epsDegrees = 0.08 // ~8.8 km cluster radius
} = {}) {
    let whereClauses = [];
    let params = [];
    let pIdx = 1;

    if (category && category !== "all") {
        whereClauses.push(`report_type = $${pIdx}`);
        params.push(category.toLowerCase());
        pIdx++;
    }

    if (district) {
        whereClauses.push(`district ILIKE $${pIdx}`);
        params.push(`%${district}%`);
        pIdx++;
    }

    if (days && !isNaN(days)) {
        whereClauses.push(`created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'`);
    }

    params.push(epsDegrees);
    const epsParamIdx = pIdx++;

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const sql = `
    WITH raw_cases AS (
        SELECT 
            id,
            report_type,
            crop,
            COALESCE(disease, pest, 'Unknown') AS condition_name,
            severity,
            confidence,
            latitude,
            longitude,
            district,
            village,
            spray,
            created_at,
            geom
        FROM spatial_reports
        ${whereStr}
    ),
    clustered AS (
        SELECT 
            rc.*,
            ST_ClusterDBSCAN(geom, eps := $${epsParamIdx}, minpoints := 1) OVER (PARTITION BY report_type, condition_name) AS cluster_idx
        FROM raw_cases rc
    ),
    cluster_centroids AS (
        SELECT 
            report_type,
            condition_name,
            crop,
            cluster_idx,
            COUNT(*)::int AS total_cases,
            ROUND(AVG(confidence)::numeric, 2) AS avg_confidence,
            ST_Centroid(ST_Collect(geom)) AS centroid_geom,
            ST_Y(ST_Centroid(ST_Collect(geom))) AS center_lat,
            ST_X(ST_Centroid(ST_Collect(geom))) AS center_lon,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::int AS cases_last_7d,
            COUNT(CASE WHEN created_at < NOW() - INTERVAL '7 days' THEN 1 END)::int AS cases_prior_7d,
            COUNT(CASE WHEN LOWER(severity) = 'critical' THEN 1 END)::int AS critical_cases,
            COUNT(CASE WHEN LOWER(severity) = 'severe' THEN 1 END)::int AS severe_cases,
            COUNT(CASE WHEN LOWER(severity) = 'moderate' THEN 1 END)::int AS moderate_cases,
            COUNT(CASE WHEN LOWER(severity) = 'low' THEN 1 END)::int AS low_cases,
            STRING_AGG(DISTINCT village, ', ') FILTER (WHERE village IS NOT NULL AND village != '') AS affected_villages,
            STRING_AGG(DISTINCT district, ', ') FILTER (WHERE district IS NOT NULL AND district != '') AS affected_districts,
            MAX(spray) AS recommended_spray,
            MAX(created_at) AS latest_detection
        FROM clustered
        GROUP BY report_type, condition_name, crop, cluster_idx
    )
    SELECT 
        cc.report_type,
        cc.condition_name,
        cc.crop,
        cc.cluster_idx,
        cc.total_cases,
        cc.avg_confidence,
        cc.center_lat,
        cc.center_lon,
        cc.cases_last_7d,
        cc.cases_prior_7d,
        cc.critical_cases,
        cc.severe_cases,
        cc.moderate_cases,
        cc.low_cases,
        cc.affected_villages,
        cc.affected_districts,
        cc.recommended_spray,
        cc.latest_detection,
        GREATEST(
            ROUND(COALESCE(MAX(ST_Distance(c.geom::geography, cc.centroid_geom::geography)), 0)) + 600,
            2400
        )::int AS radius_meters
    FROM cluster_centroids cc
    JOIN clustered c 
      ON c.report_type = cc.report_type 
     AND c.condition_name = cc.condition_name 
     AND c.crop = cc.crop 
     AND c.cluster_idx = cc.cluster_idx
    GROUP BY cc.report_type, cc.condition_name, cc.crop, cc.cluster_idx, cc.total_cases,
             cc.avg_confidence, cc.centroid_geom, cc.center_lat, cc.center_lon,
             cc.cases_last_7d, cc.cases_prior_7d, cc.critical_cases, cc.severe_cases,
             cc.moderate_cases, cc.low_cases, cc.affected_villages, cc.affected_districts,
             cc.recommended_spray, cc.latest_detection
    ORDER BY cc.total_cases DESC, cc.critical_cases DESC;
    `;

    const res = await query(sql, params);

    // Compute user distance, risk classifications, trend, and advisories
    const hasUserCoords = userLat !== null && userLon !== null && !isNaN(userLat) && !isNaN(userLon);
    const uLat = hasUserCoords ? parseFloat(userLat) : null;
    const uLon = hasUserCoords ? parseFloat(userLon) : null;

    const hotspots = res.rows.map((row, idx) => {
        const isDisease = row.report_type === "disease";
        const prefix = isDisease ? "HS-D" : "HS-P";
        const hotspotId = `${prefix}-${(idx + 1).toString().padStart(2, "0")}`;

        // 1. Risk Classification
        let riskLevel = "SPORADIC_DETECTION";
        let riskLabel = "Sporadic Watch";
        let riskBadge = "🟡 Monitor";

        if (row.critical_cases > 0 || row.total_cases >= 4) {
            riskLevel = "CRITICAL_OUTBREAK";
            riskLabel = "Critical Outbreak";
            riskBadge = "🔴 Critical Alert";
        } else if (row.severe_cases > 0 || row.total_cases >= 2) {
            riskLevel = "EMERGING_HOTSPOT";
            riskLabel = "Emerging Hotspot";
            riskBadge = "🟠 Emerging Alert";
        }

        // 2. Spread Trend
        let trend = "Active ➡️";
        let trendDescription = "Report frequency holding steady";
        if (row.cases_last_7d > row.cases_prior_7d) {
            trend = "Surging ↗️";
            trendDescription = "New cases accelerating in this zone (+ " + (row.cases_last_7d - row.cases_prior_7d) + " this week)";
        } else if (row.cases_last_7d === 0 && row.cases_prior_7d > 0) {
            trend = "Contained ↘️";
            trendDescription = "No new cases in last 7 days; containment holding";
        }

        // 3. User Proximity
        let distanceFromUserKm = null;
        if (hasUserCoords) {
            distanceFromUserKm = calculateHaversineKm(uLat, uLon, row.center_lat, row.center_lon);
        }

        // 4. Prevention Advisory for neighboring farms
        let preventiveAdvisory = "";
        if (isDisease) {
            preventiveAdvisory = `Prophylactic fungicide spray recommended for all ${row.crop} fields within ${(row.radius_meters / 1000 + 4).toFixed(1)} km before spore drift spreads. Protocol: ${row.recommended_spray || "Mancozeb 75% WP @ 2.5g/L"}.`;
        } else {
            preventiveAdvisory = `Install 8 pheromone / yellow sticky traps per acre immediately across ${row.crop} plots in this cluster. Monitor ETL limits daily. Target spray: ${row.recommended_spray || "Fipronil 5% SC @ 1.5ml/L"}.`;
        }

        // 5. Official / Extension Officer Guidance
        const officerAction = `${riskLabel} flagged in ${row.affected_districts || "District"} (${row.affected_villages || "Cluster Zone"}). Dispatch Krishi Sahayak for field confirmation and community awareness camp.`;

        return {
            hotspotId,
            category: row.report_type,
            conditionName: row.condition_name,
            crop: row.crop,
            totalCases: row.total_cases,
            casesLast7d: row.cases_last_7d,
            casesPrior7d: row.cases_prior_7d,
            riskLevel,
            riskLabel,
            riskBadge,
            trend,
            trendDescription,
            center: {
                lat: row.center_lat,
                lon: row.center_lon
            },
            radiusMeters: row.radius_meters,
            radiusKm: parseFloat((row.radius_meters / 1000).toFixed(2)),
            distanceFromUserKm,
            avgConfidence: parseFloat(row.avg_confidence),
            severityBreakdown: {
                critical: row.critical_cases,
                severe: row.severe_cases,
                moderate: row.moderate_cases,
                low: row.low_cases
            },
            affectedVillages: row.affected_villages ? row.affected_villages.split(", ") : [],
            affectedDistricts: row.affected_districts ? row.affected_districts.split(", ") : [],
            recommendedSpray: row.recommended_spray,
            preventiveAdvisory,
            officerAction,
            latestDetection: row.latest_detection
        };
    });

    // High-Level Analytics
    const analytics = {
        totalHotspots: hotspots.length,
        diseaseHotspotsCount: hotspots.filter(h => h.category === "disease").length,
        pestHotspotsCount: hotspots.filter(h => h.category === "pest").length,
        criticalCount: hotspots.filter(h => h.riskLevel === "CRITICAL_OUTBREAK").length,
        emergingCount: hotspots.filter(h => h.riskLevel === "EMERGING_HOTSPOT").length,
        sporadicCount: hotspots.filter(h => h.riskLevel === "SPORADIC_DETECTION").length,
        topThreat: hotspots.length > 0 ? hotspots[0].conditionName : "None",
        highestRiskCrop: hotspots.length > 0 ? hotspots[0].crop : "None"
    };

    return { hotspots, analytics };
}

/**
 * Find nearby reports within a radius using PostGIS ST_DWithin & ST_Distance
 * STRICT PRIVACY: Zero farmer personal identities are exposed.
 */
async function getNearbyReports({
    lat,
    lon,
    radiusKm = 25,
    type = "all",
    severity = "all",
    limit = 100
}) {
    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);
    const radiusMeters = parseFloat(radiusKm) * 1000;

    let whereClauses = [
        "ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)"
    ];
    let params = [userLon, userLat, radiusMeters];
    let pIdx = 4;

    if (type && type !== "all") {
        whereClauses.push(`report_type = $${pIdx}`);
        params.push(type.toLowerCase());
        pIdx++;
    }

    if (severity && severity !== "all") {
        whereClauses.push(`LOWER(severity) = $${pIdx}`);
        params.push(severity.toLowerCase());
        pIdx++;
    }

    params.push(limit);

    // Return strictly anonymized observation records
    const sql = `
        SELECT 
            id,
            CONCAT('OBS-', LPAD(id::text, 4, '0')) AS observation_id,
            report_type,
            crop,
            disease,
            pest,
            COALESCE(disease, pest, 'Unknown') AS condition,
            severity,
            confidence,
            latitude,
            longitude,
            district,
            village,
            weather_temp,
            weather_humidity,
            spray,
            notes,
            created_at,
            ROUND((ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 2) AS distance_km
        FROM spatial_reports
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY distance_km ASC
        LIMIT $${pIdx};
    `;

    const res = await query(sql, params);
    return res.rows;
}

/**
 * Return GeoJSON FeatureCollection formatted directly for Leaflet
 * STRICT PRIVACY: Zero farmer personal identities are exposed.
 */
async function getReportsGeoJson({
    type = "all",
    severity = "all",
    days = 60,
    limit = 250
}) {
    let whereClauses = [];
    let params = [];
    let pIdx = 1;

    if (type && type !== "all") {
        whereClauses.push(`report_type = $${pIdx}`);
        params.push(type.toLowerCase());
        pIdx++;
    }

    if (severity && severity !== "all") {
        whereClauses.push(`LOWER(severity) = $${pIdx}`);
        params.push(severity.toLowerCase());
        pIdx++;
    }

    if (days && !isNaN(days)) {
        whereClauses.push(`created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'`);
    }

    params.push(limit);

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const sql = `
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
                json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(geom)::json,
                    'properties', json_build_object(
                        'id', id,
                        'observationId', CONCAT('OBS-', LPAD(id::text, 4, '0')),
                        'reportType', report_type,
                        'crop', crop,
                        'disease', disease,
                        'pest', pest,
                        'condition', COALESCE(disease, pest, 'Unknown'),
                        'severity', severity,
                        'confidence', confidence,
                        'latitude', latitude,
                        'longitude', longitude,
                        'district', district,
                        'village', village,
                        'weatherTemp', weather_temp,
                        'weatherHumidity', weather_humidity,
                        'spray', spray,
                        'notes', notes,
                        'timestamp', created_at
                    )
                )
            ), '[]'::json)
        ) AS geojson
        FROM (
            SELECT *
            FROM spatial_reports
            ${whereStr}
            ORDER BY created_at DESC
            LIMIT $${pIdx}
        ) sub;
    `;

    const res = await query(sql, params);
    return res.rows[0]?.geojson || { type: "FeatureCollection", features: [] };
}

/**
 * Spatial threat summary around farmer's coordinate
 */
async function getSpatialSummary({ lat, lon, radiusKm = 25 }) {
    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);
    const radiusMeters = parseFloat(radiusKm) * 1000;

    const sql = `
        SELECT 
            COUNT(*) as total_reports,
            COUNT(CASE WHEN report_type = 'disease' THEN 1 END) as disease_count,
            COUNT(CASE WHEN report_type = 'pest' THEN 1 END) as pest_count,
            COUNT(CASE WHEN LOWER(severity) IN ('critical', 'severe') THEN 1 END) as high_risk_count,
            MIN(ROUND((ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 1)) as closest_threat_km
        FROM spatial_reports
        WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3);
    `;

    const res = await query(sql, [userLon, userLat, radiusMeters]);
    const row = res.rows[0] || {};

    return {
        totalReports: parseInt(row.total_reports || 0, 10),
        diseaseCount: parseInt(row.disease_count || 0, 10),
        pestCount: parseInt(row.pest_count || 0, 10),
        highRiskCount: parseInt(row.high_risk_count || 0, 10),
        closestThreatKm: row.closest_threat_km !== null ? parseFloat(row.closest_threat_km) : null,
        radiusKm: parseFloat(radiusKm)
    };
}

/**
 * Haversine formula helper for distance calculation
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
}

module.exports = {
    initSpatialDB,
    recordSpatialReport,
    getNearbyReports,
    getReportsGeoJson,
    getSpatialSummary,
    getHotspots
};
