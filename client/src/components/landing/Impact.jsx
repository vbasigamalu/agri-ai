import React from "react";
import {
  ShieldCheckIcon,
  ActivityIcon,
  MapPinIcon,
  GlobeIcon,
  CheckCircleIcon
} from "../Icons";

export default function Impact() {
  const impacts = [
    {
      title: "Early Detection",
      subtitle: "Arresting Pathogens at Incipient Stage",
      desc: "Diagnosing localized foliar lesions before widespread necrotic collapse enables low-cost curative intervention and saves vulnerable neighboring rows.",
      Icon: ShieldCheckIcon,
      highlight: "Incipient Symptom Screening"
    },
    {
      title: "Risk Awareness",
      subtitle: "Pre-Emptive Climate Intelligence",
      desc: "Environmental microclimate correlation warns growers before favorable spore incubation windows mature, shifting pest control from reactive to preventive.",
      Icon: ActivityIcon,
      highlight: "Microclimate Forewarning"
    },
    {
      title: "Targeted Surveillance",
      subtitle: "Geospatial Outbreak Containment",
      desc: "Automated spatial clustering allows agricultural extension officers, KVKs, and state departments to direct biosecurity resources exactly where outbreaks begin.",
      Icon: MapPinIcon,
      highlight: "Cluster-Level Response"
    },
    {
      title: "Accessible Advisory",
      subtitle: "Vernacular Agronomic Empowerment",
      desc: "Delivering ICAR-grounded guidance in Marathi, Hindi, and English ensures every smallholder farmer understands how, when, and what treatment to apply safely.",
      Icon: GlobeIcon,
      highlight: "Native Language Advisory"
    }
  ];

  return (
    <section className="landing-section" id="impact">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <CheckCircleIcon size={14} color="var(--agri-primary)" />
            <span>Operational & Agronomic Value</span>
          </div>
          <h2 className="section-title">
            Built for Earlier Action, Better Monitoring.
          </h2>
          <p className="section-desc">
            Agri-AI focuses on systemic agricultural resilience — empowering individual cultivators while equipping regional authorities with real-time crop disease surveillance.
          </p>
        </div>

        <div className="impact-grid">
          {impacts.map((item, idx) => {
            const ImpactIcon = item.Icon;
            return (
              <div key={idx} className="impact-card">
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: "var(--agri-accent-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--agri-primary)",
                  marginBottom: "1.25rem"
                }}>
                  <ImpactIcon size={22} />
                </div>

                <div style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "var(--agri-primary)",
                  letterSpacing: "0.04em",
                  marginBottom: "0.35rem"
                }}>
                  {item.highlight}
                </div>

                <h3>{item.title}</h3>

                <p style={{
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  color: "var(--agri-dark)",
                  marginBottom: "0.5rem"
                }}>
                  {item.subtitle}
                </p>

                <p>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
