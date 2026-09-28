export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";

  // 1. Alerts
  if (url.includes("/alerts")) {
    const district = req.query?.district || "Maharashtra";
    return res.status(200).json({
      success: true,
      district,
      count: 3,
      alerts: [
        {
          id: `fu-CASE-2026-089`,
          alert_type: "followup_due",
          severity: "info",
          title: "Follow-up Inspection Due: CASE-2026-089",
          message: "Day 5 re-inspection scheduled for Tomato Early Blight. Please upload a fresh leaf photo to verify healing progress.",
          district,
          created_at: new Date().toISOString()
        },
        {
          id: `wx-${district}`,
          alert_type: "weather_risk",
          severity: "warning",
          title: `High Humidity Advisory · ${district}`,
          message: "Relative humidity forecasted above 82% over the next 48 hours. Fungal spore germination index is Elevated.",
          district,
          created_at: new Date().toISOString()
        },
        {
          id: `pest-${district}`,
          alert_type: "pest_vigilance",
          severity: "info",
          title: `Pest Vigilance Reminder · ${district}`,
          message: "Active yellow and blue sticky trap monitoring recommended for early whitefly and thrips detection.",
          district,
          created_at: new Date().toISOString()
        }
      ]
    });
  }

  // 2. Follow-up Cases & Timeline
  if (url.includes("/followup/timeline/")) {
    return res.status(200).json({
      success: true,
      case: {
        case_ref: "CASE-2026-089",
        crop: "Tomato",
        location_district: "Sangli",
        initial_condition: "Tomato Early Blight",
        initial_severity_pct: 42,
        initial_confidence: 0.94,
        opened_at: new Date(Date.now() - 6 * 86400000).toISOString(),
        next_followup_date: new Date(Date.now() - 1 * 86400000).toISOString(),
        status: "resolved",
        farmer_name: "Vishnukant B.",
        day1_image_url: "https://images.unsplash.com/photo-1592417817098-8f3d6eb22657?w=600&auto=format&fit=crop&q=80",
        day5_image_url: "https://images.unsplash.com/photo-1598512752271-33f913a5af13?w=600&auto=format&fit=crop&q=80"
      },
      comparison: {
        status: "improving",
        severityDelta: -24,
        explanation: "Positive Recovery: Lesion surface reduced from 42% to 18%. Mancozeb spray halted concentric ring expansion.",
        day1: {
          imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6eb22657?w=600&auto=format&fit=crop&q=80",
          severityPct: 42,
          condition: "Tomato Early Blight",
          confidence: 0.94
        },
        latest: {
          imageUrl: "https://images.unsplash.com/photo-1598512752271-33f913a5af13?w=600&auto=format&fit=crop&q=80",
          severityPct: 18,
          dayOffset: 5,
          inspectedAt: new Date(Date.now() - 1 * 86400000).toISOString()
        }
      },
      treatments: [
        {
          chemical_name: "Mancozeb 75% WP (Indofil M-45)",
          dosage: "2.5 g / Liter water",
          treatment_type: "chemical",
          application_date: new Date(Date.now() - 5 * 86400000).toISOString()
        },
        {
          chemical_name: "Trichoderma viride Bio-fungicide",
          dosage: "5 g / Liter water",
          treatment_type: "biological",
          application_date: new Date(Date.now() - 2 * 86400000).toISOString()
        }
      ],
      timeline: [
        {
          type: "initial_diagnosis",
          title: "Day 1: Initial Diagnosis",
          date: new Date(Date.now() - 6 * 86400000).toISOString(),
          description: "Vision AI detected 42% lesion coverage. Standard treatment protocol prescribed."
        },
        {
          type: "treatment_applied",
          title: "Day 2: Chemical Foliar Application",
          date: new Date(Date.now() - 5 * 86400000).toISOString(),
          description: "Farmer confirmed foliar spray applied under favorable weather window."
        },
        {
          type: "followup_inspection",
          title: "Day 5: Re-inspection Foliage Scan",
          date: new Date(Date.now() - 1 * 86400000).toISOString(),
          description: "Foliage photo uploaded. Lesion necrosis shrank from 42% to 18% (-24% shift). Verdict: IMPROVING."
        }
      ],
      caseRef: "CASE-2026-089",
      crop: "Tomato",
      status: "improving",
      history: [
        {
          inspection_type: "initial_scan",
          day_offset: 0,
          severity_pct: 42,
          image_url: "https://images.unsplash.com/photo-1592417817098-8f3d6eb22657?w=600&auto=format&fit=crop&q=80",
          notes: "Initial AI diagnosis identified active pathogen spread.",
          created_at: new Date(Date.now() - 6 * 86400000).toISOString()
        },
        {
          inspection_type: "day5_reinspection",
          day_offset: 5,
          severity_pct: 18,
          image_url: "https://images.unsplash.com/photo-1598512752271-33f913a5af13?w=600&auto=format&fit=crop&q=80",
          notes: "Positive recovery: lesion coverage reduced to 18%.",
          created_at: new Date(Date.now() - 1 * 86400000).toISOString()
        }
      ]
    });
  }

  if (url.includes("/followup/submit")) {
    return res.status(200).json({
      success: true,
      caseRef: "CASE-2026-089",
      progression: {
        status: "improving",
        severityDelta: -24,
        explanation: "Positive Recovery: Foliar lesion surface area reduced by 24% (from 42% to 18%). CIB&RC spray suppressed fungal spore expansion.",
        day1: {
          imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6eb22657?w=600&auto=format&fit=crop&q=80",
          severityPct: 42,
          condition: "Tomato Early Blight",
          confidence: 0.94
        },
        latest: {
          imageUrl: "https://images.unsplash.com/photo-1598512752271-33f913a5af13?w=600&auto=format&fit=crop&q=80",
          severityPct: 18,
          dayOffset: 5,
          inspectedAt: new Date().toISOString(),
          condition: "Tomato Early Blight (Healing Lesions)"
        }
      },
      timeline: [
        {
          type: "initial_diagnosis",
          title: "Day 1: Initial Diagnosis",
          date: new Date(Date.now() - 6 * 86400000).toISOString(),
          description: "Vision AI detected 42% lesion coverage. Standard treatment protocol prescribed."
        },
        {
          type: "treatment_applied",
          title: "Day 2: Chemical Foliar Application",
          date: new Date(Date.now() - 5 * 86400000).toISOString(),
          description: "Farmer confirmed foliar spray applied under favorable weather window."
        },
        {
          type: "followup_inspection",
          title: "Day 5: Re-inspection Foliage Scan",
          date: new Date().toISOString(),
          description: "Foliage photo analyzed. Lesion necrosis shrank from 42% to 18% (-24% shift). Verdict: IMPROVING."
        }
      ]
    });
  }

  if (url.includes("/followup/cases")) {
    return res.status(200).json({
      success: true,
      count: 2,
      cases: [
        {
          id: 1,
          case_ref: "CASE-2026-089",
          crop: "Tomato",
          category: "fungal",
          initial_condition: "Tomato Early Blight",
          initial_confidence: 0.94,
          initial_severity: "Moderate",
          initial_severity_pct: 42,
          district: "Sangli",
          village: "Miraj",
          farmer_name: "Vishnukant B.",
          status: "resolved",
          opened_at: new Date(Date.now() - 6 * 86400000).toISOString(),
          next_followup_date: new Date(Date.now() - 1 * 86400000).toISOString(),
          day1_image_url: "https://images.unsplash.com/photo-1592417817098-8f3d6eb22657?w=600&auto=format&fit=crop&q=80",
          day5_image_url: "https://images.unsplash.com/photo-1598512752271-33f913a5af13?w=600&auto=format&fit=crop&q=80",
          comparison: {
            status: "improving",
            severityDelta: -24,
            explanation: "Positive Recovery: Lesion surface reduced from 42% to 18%."
          }
        },
        {
          id: 2,
          case_ref: "CASE-2026-104",
          crop: "Grape",
          category: "fungal",
          initial_condition: "Grape Powdery Mildew",
          initial_confidence: 0.91,
          initial_severity: "Critical",
          initial_severity_pct: 68,
          district: "Nashik",
          village: "Pimpalgaon",
          farmer_name: "Suresh Patil",
          status: "in_progress",
          opened_at: new Date(Date.now() - 2 * 86400000).toISOString(),
          next_followup_date: new Date(Date.now() + 3 * 86400000).toISOString(),
          day1_image_url: "https://images.unsplash.com/photo-1596541609904-8977462c1cfd?w=600&auto=format&fit=crop&q=80",
          day5_image_url: null,
          comparison: null
        }
      ]
    });
  }

  // 3. Spatial GIS Outbreaks
  if (url.includes("/spatial/hotspots")) {
    return res.status(200).json({
      success: true,
      filter: { category: "all", days: 45, district: "Maharashtra" },
      analytics: {
        totalHotspots: 3,
        activeThreats: 3,
        highSeverityClusters: 1,
        criticalZone: "Sangli-Kolhapur Agri Corridor"
      },
      hotspots: [
        {
          hotspotId: "HOTSPOT-001",
          cluster_id: 1,
          category: "disease",
          conditionName: "Tomato Early Blight",
          crop: "Tomato",
          totalCases: 16,
          riskLevel: "CRITICAL_OUTBREAK",
          riskLabel: "Critical Outbreak",
          riskBadge: "🔴 Critical Alert",
          trend: "Surging ↗️",
          trendDescription: "New cases accelerating in this zone (+4 this week)",
          center: { lat: 16.8524, lon: 74.5815 },
          radiusMeters: 8500,
          radiusKm: 8.5,
          distanceFromUserKm: 2.1,
          affectedVillages: ["Miraj Rural", "Kupwad", "Tasgaon"],
          affectedDistricts: ["Sangli"],
          recommendedSpray: "Mancozeb 75% WP @ 2.5g/L",
          preventiveAdvisory: "Prophylactic fungicide spray recommended within 12 km before spore drift spreads.",
          officerAction: "Critical Outbreak flagged in Sangli. Krishi Sahayak team dispatched."
        },
        {
          hotspotId: "HOTSPOT-002",
          cluster_id: 2,
          category: "disease",
          conditionName: "Grape Powdery Mildew",
          crop: "Grape",
          totalCases: 24,
          riskLevel: "CRITICAL_OUTBREAK",
          riskLabel: "Critical Outbreak",
          riskBadge: "🔴 Critical Alert",
          trend: "Active ➡️",
          trendDescription: "Report frequency holding steady",
          center: { lat: 19.9975, lon: 73.7898 },
          radiusMeters: 12000,
          radiusKm: 12.0,
          distanceFromUserKm: 14.3,
          affectedVillages: ["Pimpalgaon", "Dindori", "Niphad"],
          affectedDistricts: ["Nashik"],
          recommendedSpray: "Wettable Sulfur 80% WDG @ 2g/L",
          preventiveAdvisory: "Canopy aeration and preventive sulfur dusting recommended across vineyards.",
          officerAction: "High-density spore alert issued for Niphad-Dindori belt."
        },
        {
          hotspotId: "HOTSPOT-003",
          cluster_id: 3,
          category: "pest",
          conditionName: "Fall Armyworm (Spodoptera frugiperda)",
          crop: "Maize",
          totalCases: 11,
          riskLevel: "EMERGING_HOTSPOT",
          riskLabel: "Emerging Hotspot",
          riskBadge: "🟠 Emerging Alert",
          trend: "Surging ↗️",
          trendDescription: "Whirl leaf damage expanding in young crops",
          center: { lat: 17.6599, lon: 75.9064 },
          radiusMeters: 6800,
          radiusKm: 6.8,
          distanceFromUserKm: 28.5,
          affectedVillages: ["Mohol", "Barshi", "Karmala"],
          affectedDistricts: ["Solapur"],
          recommendedSpray: "Emamectin Benzoate 5% SG @ 0.4g/L",
          preventiveAdvisory: "Install pheromone traps (5/acre) and inspect leaf whorls for sawdust frass.",
          officerAction: "Trap distribution drive underway via Taluka Agriculture Office."
        }
      ]
    });
  }

  if (url.includes("/spatial/nearby")) {
    const lat = parseFloat(req.query?.lat) || 16.8524;
    const lon = parseFloat(req.query?.lon) || 74.5815;
    return res.status(200).json({
      success: true,
      center: { lat, lon },
      radiusKm: 25,
      count: 2,
      reports: [
        {
          id: "rep-101",
          lat: lat + 0.012,
          lon: lon + 0.008,
          crop: "Tomato",
          threat: "Tomato Early Blight",
          category: "disease",
          severity: "High",
          distanceKm: 1.4,
          reportedAt: new Date(Date.now() - 3600000 * 4).toISOString()
        },
        {
          id: "rep-102",
          lat: lat - 0.015,
          lon: lon - 0.011,
          crop: "Soybean",
          threat: "Armyworm Outbreak",
          category: "pest",
          severity: "Moderate",
          distanceKm: 2.3,
          reportedAt: new Date(Date.now() - 3600000 * 18).toISOString()
        }
      ]
    });
  }

  if (url.includes("/spatial/summary")) {
    return res.status(200).json({
      success: true,
      summary: {
        radiusKm: 25,
        totalOutbreaks: 5,
        highSeverityCount: 2,
        criticalAlert: true,
        nearestThreat: {
          threat: "Tomato Early Blight",
          crop: "Tomato",
          distanceKm: 1.4,
          severity: "High"
        },
        riskLevel: "Elevated"
      }
    });
  }

  // 4. Expert Stats & Cases
  if (url.includes("/expert/stats")) {
    return res.status(200).json({
      success: true,
      stats: {
        pendingCases: 3,
        confirmedCases: 42,
        correctedCases: 3,
        totalReviewed: 45,
        agreementRate: 93.3,
        groundTruthSamples: 45
      }
    });
  }

  if (url.includes("/expert/cases")) {
    return res.status(200).json({
      success: true,
      count: 2,
      cases: [
        {
          id: 101,
          crop: "Tomato",
          category: "fungal",
          predicted_condition: "Tomato Early Blight",
          ai_confidence: 0.88,
          severity: "Moderate",
          status: "pending",
          district: "Sangli",
          farmer_name: "Ramesh P.",
          image_url: "https://images.unsplash.com/photo-1592417817098-8f3d6eb22657?w=600&auto=format&fit=crop&q=80",
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          vlm_observations: "Concentric target rings visible on lower canopy."
        },
        {
          id: 102,
          crop: "Grape",
          category: "fungal",
          predicted_condition: "Powdery Mildew",
          ai_confidence: 0.93,
          severity: "Critical",
          status: "pending",
          district: "Nashik",
          farmer_name: "Ashok K.",
          image_url: "https://images.unsplash.com/photo-1596541609904-8977462c1cfd?w=600&auto=format&fit=crop&q=80",
          created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
          vlm_observations: "White mycelial patch on upper leaf surface."
        }
      ]
    });
  }

  // 5. History
  if (url.includes("/history")) {
    return res.status(200).json([
      {
        _id: "hist-101",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        crop: "Tomato",
        diseaseName: "Early Blight (Alternaria solani)",
        confidence: 93,
        severity: "Moderate",
        causedBy: "Fungus (Alternaria solani)",
        temperature: 27,
        humidity: 78,
        spray: "Mancozeb 75% WP (2.5 g / L water)",
        sprayWarnings: ["Apply early morning before wind speed exceeds 12 km/h"],
        alert: "Moderate Fungal Threat Active",
        advice: [
          "Prune and dispose of infected bottom leaves.",
          "Spray Mancozeb 75 WP thoroughly over canopy.",
          "Keep foliage dry with drip irrigation."
        ]
      }
    ]);
  }

  // 6. Status
  if (url.includes("/status")) {
    return res.status(200).json({
      ready: true,
      status: "✅ AI NEURAL ENGINE ACTIVE!",
      engine: "WASM (SIMD Turbo)",
      instanceId: "prod-sih-2026"
    });
  }

  // 7. Auth Login / Register
  if (url.includes("/auth/login") || url.includes("/auth/register")) {
    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      token: "agri_jwt_token_2026",
      user: {
        id: 1,
        name: "Farmer",
        phone_or_email: "farmer@agri-ai.org",
        district: "Sangli",
        role: "farmer"
      }
    });
  }

  // Default Fallback
  return res.status(200).json({ success: true, message: "Agri-AI Cloud Gateway Active" });
}
