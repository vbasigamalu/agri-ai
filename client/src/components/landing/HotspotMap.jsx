import React, { useState } from "react";
import { MapIcon, FlameIcon, LocationPinIcon, PestIcon, LeafIcon, ShieldIcon } from "../Icons";

export default function HotspotMap() {
  const [activeTab, setActiveTab] = useState("disease"); // "disease" | "pest"
  const [selectedCrop, setSelectedCrop] = useState("Tomato");
  const [selectedThreat, setSelectedThreat] = useState("Early Blight");
  const [selectedWindow, setSelectedWindow] = useState("Last 7 Days");

  // Sample realistic Maharashtra agricultural district clusters
  const clusters = [
    {
      id: "sangli",
      district: "Sangli",
      taluka: "Miraj / Tasgaon",
      cases: activeTab === "disease" ? 14 : 22,
      risk: "Critical Outbreak",
      color: "#dc2626",
      top: "58%",
      left: "48%",
      trend: "+3 cases today"
    },
    {
      id: "nashik",
      district: "Nashik",
      taluka: "Pimpalgaon / Niphad",
      cases: activeTab === "disease" ? 9 : 17,
      risk: "Emerging Cluster",
      color: "#ea580c",
      top: "32%",
      left: "38%",
      trend: "+1 case today"
    },
    {
      id: "pune",
      district: "Pune",
      taluka: "Junnar / Baramati",
      cases: activeTab === "disease" ? 6 : 8,
      risk: "Emerging Cluster",
      color: "#ea580c",
      top: "45%",
      left: "42%",
      trend: "Stable"
    },
    {
      id: "kolhapur",
      district: "Kolhapur",
      taluka: "Shirol / Hatkanangle",
      cases: activeTab === "disease" ? 3 : 5,
      risk: "Monitored Zone",
      color: "#166534",
      top: "70%",
      left: "44%",
      trend: "Declining"
    }
  ];

  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <MapIcon size={14} color="var(--agri-primary)" />
            <span>Geospatial Biosecurity Intelligence</span>
          </div>
          <h2 className="section-title">See Where Crop Threats Are Emerging.</h2>
          <p className="section-desc">
            Aggregate field observations by location and time to identify areas with higher concentrations of reported or validated disease and pest activity.
          </p>
        </div>

        {/* Interactive Hotspot Map Viewer Card */}
        <div className="hotspot-viewer-card">
          {/* Top Controls Bar */}
          <div className="hotspot-top-bar">
            {/* Mode Switcher Tabs */}
            <div className="hotspot-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === "disease" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("disease");
                  setSelectedThreat("Early Blight");
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <LeafIcon size={14} />
                <span>Disease Hotspots</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === "pest" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("pest");
                  setSelectedThreat("Fruit Borer (Helicoverpa)");
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <PestIcon size={14} />
                <span>Pest Hotspots</span>
              </button>
            </div>

            {/* Filter Badges */}
            <div className="hotspot-filter-pills">
              <span className="filter-badge">
                Crop: <strong>{selectedCrop}</strong>
              </span>
              <span className="filter-badge">
                Target: <strong>{selectedThreat}</strong>
              </span>
              <span className="filter-badge">
                Window: <strong>{selectedWindow}</strong>
              </span>
            </div>
          </div>

          {/* Map Canvas with Stylized Coordinates & Beacons */}
          <div className="hotspot-map-canvas">
            {/* Clean SVG Cartographic Grid Overlay */}
            <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, opacity: 0.25 }}>
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#65a30d" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {/* Region Outline hint */}
              <path
                d="M 120 80 Q 220 50 360 120 T 520 200 T 400 340 T 200 310 Z"
                fill="rgba(22, 101, 52, 0.04)"
                stroke="#166534"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </svg>

            {/* Render Agricultural District Cluster Nodes */}
            {clusters.map((c) => (
              <div
                key={c.id}
                className="district-node"
                style={{ top: c.top, left: c.left }}
              >
                <div
                  className="node-pulse-ring"
                  style={{ backgroundColor: c.color }}
                />
                <div
                  className="node-pin"
                  style={{ borderColor: c.color, color: "var(--agri-text)" }}
                >
                  <FlameIcon size={14} color={c.color} />
                  <span>
                    {c.district} ({c.cases} cases)
                  </span>
                </div>
              </div>
            ))}

            {/* Floating Map Legend & DBSCAN Status */}
            <div style={{
              position: "absolute",
              bottom: "1rem",
              left: "1.25rem",
              background: "rgba(255, 255, 255, 0.94)",
              backdropFilter: "blur(6px)",
              padding: "0.65rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid var(--agri-border)",
              fontSize: "0.75rem",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              maxWidth: "280px"
            }}>
              <div style={{ fontWeight: 800, color: "var(--agri-dark)", marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: "4px" }}>
                <ShieldIcon size={13} color="var(--agri-primary)" />
                <span>PostGIS 3.6 Spatial Density (DBSCAN)</span>
              </div>
              <div style={{ color: "var(--agri-text-muted)" }}>
                Anonymous cluster tracking: 5 km radius, minimum 3 reports threshold. Zero farmer PII displayed.
              </div>
            </div>

            {/* Quick Summary Pill */}
            <div style={{
              position: "absolute",
              top: "1rem",
              right: "1.25rem",
              background: "rgba(255, 255, 255, 0.94)",
              padding: "0.5rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid var(--agri-border)",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--agri-primary)"
            }}>
              Active Biosecurity Coverage: 4 Districts · 51 Trap Stations
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
