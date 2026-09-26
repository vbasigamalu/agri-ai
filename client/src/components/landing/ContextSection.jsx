import React from "react";
import {
  CloudSunIcon,
  LeafIcon,
  LocationPinIcon,
  ClockIcon,
  PestIcon,
  CheckCircleIcon,
  BrainIcon,
  ShieldIcon,
  AlertTriangleIcon
} from "../Icons";

export default function ContextSection() {
  const inputs = [
    { title: "Weather Feed", sub: "Temp, relative humidity & rain", Icon: CloudSunIcon },
    { title: "Crop Stage", sub: "Seedling, flowering or fruiting", Icon: LeafIcon },
    { title: "Crop Variety", sub: "Host resistance & cultivar traits", Icon: ShieldIcon },
    { title: "Location", sub: "Microclimate & soil moisture zone", Icon: LocationPinIcon },
    { title: "Historical Cases", sub: "Prior seasonal infection records", Icon: ClockIcon },
    { title: "Pest Trap Data", sub: "Pheromone & sticky card counts", Icon: PestIcon },
    { title: "Field Observations", sub: "Canopy density & irrigation method", Icon: CheckCircleIcon }
  ];

  return (
    <section className="landing-section landing-section-alt" id="risk-monitoring">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <BrainIcon size={14} color="var(--agri-primary)" />
            <span>Multi-Factor Environmental Intelligence</span>
          </div>
          <h2 className="section-title">Every Field Has Its Own Story.</h2>
          <p className="section-desc">
            Plant pathology relies on the classical Disease Triangle: a susceptible host, a virulent pathogen, and a favorable environment. Agri-AI synthesizes field context to assess true vulnerability.
          </p>
        </div>

        <div className="context-layout">
          {/* Left Column: Data Sources Ingestion */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--agri-dark)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>Converging Field Parameters</span>
              <span style={{ fontSize: "0.75rem", background: "var(--agri-accent-subtle)", color: "var(--agri-primary)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                7 Data Feeds
              </span>
            </h3>

            <div className="context-inputs-list">
              {inputs.map((inp) => {
                const InpIcon = inp.Icon;
                return (
                  <div key={inp.title} className="context-chip">
                    <div style={{ color: "var(--agri-primary)", flexShrink: 0 }}>
                      <InpIcon size={20} />
                    </div>
                    <div>
                      <strong>{inp.title}</strong>
                      <span>{inp.sub}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Crucial Scientific Boundary Statement */}
            <div style={{ marginTop: "1.25rem", padding: "0.85rem 1rem", background: "#ffffff", border: "1px solid var(--agri-border)", borderRadius: "8px", fontSize: "0.82rem", color: "var(--agri-text-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlertTriangleIcon size={16} color="var(--agri-amber)" style={{ flexShrink: 0 }} />
              <span>
                <strong>Scientific Safeguard:</strong> Weather is strictly utilized as supporting environmental context to assess spore germination probability, never as standalone proof of diagnosis.
              </span>
            </div>
          </div>

          {/* Right Column: Context & Risk Engine -> Output Levels */}
          <div className="context-levels-container">
            <div style={{ padding: "0.85rem 1.25rem", background: "var(--agri-dark)", color: "#ffffff", borderRadius: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--agri-accent)" }}>
                Processing Hub
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0.2rem 0" }}>
                Context &amp; Risk Engine
              </div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                Correlates foliar vision confidence with environmental risk matrix
              </div>
            </div>

            {/* LOW Risk Card */}
            <div className="risk-level-card low">
              <div className="risk-card-head">
                <span className="risk-title">Low Risk</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--agri-primary)", background: "var(--agri-accent-subtle)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                  Routine
                </span>
              </div>
              <div className="risk-desc">
                Environmental parameters (low relative humidity, dry canopy) disfavor spore release. Standard weekly scouting recommended; no chemical spray warranted.
              </div>
            </div>

            {/* MODERATE Risk Card */}
            <div className="risk-level-card moderate">
              <div className="risk-card-head">
                <span className="risk-title">Moderate Risk</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--agri-amber)", background: "var(--agri-amber-subtle)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                  Advisory
                </span>
              </div>
              <div className="risk-desc">
                Prolonged relative humidity (&gt;75%) and moderate temperatures create an incubation window. Preventive organic measures (neem/Trichoderma) advised.
              </div>
            </div>

            {/* HIGH Risk Card */}
            <div className="risk-level-card high">
              <div className="risk-card-head">
                <span className="risk-title">High Risk</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--agri-red)", background: "var(--agri-red-subtle)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                  Urgent Alert
                </span>
              </div>
              <div className="risk-desc">
                Continuous leaf wetness, rainfall, and high trap counts indicate rapid outbreak potential. Targeted systemic intervention required within 24–48 hours.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
