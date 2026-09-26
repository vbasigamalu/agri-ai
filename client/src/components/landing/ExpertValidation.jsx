import React from "react";
import {
  ExpertIcon,
  CpuIcon,
  CheckCircleIcon,
  XCircleIcon,
  HelpCircleIcon,
  DatabaseIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  RefreshCwIcon
} from "../Icons";

export default function ExpertValidation() {
  const validationStatuses = [
    {
      label: "Confirmed",
      color: "var(--agri-primary)",
      bg: "var(--agri-accent-subtle)",
      border: "rgba(16, 185, 129, 0.3)",
      Icon: CheckCircleIcon,
      desc: "Pathology expert confirms AI prediction matches leaf symptoms and field context."
    },
    {
      label: "Corrected",
      color: "var(--agri-amber)",
      bg: "var(--agri-amber-subtle)",
      border: "var(--agri-amber-border)",
      Icon: XCircleIcon,
      desc: "Expert re-annotates complex multi-pathogen or nutritional deficiency confounders."
    },
    {
      label: "Uncertain",
      color: "var(--agri-text-muted)",
      bg: "#f1f5f9",
      border: "var(--agri-border)",
      Icon: HelpCircleIcon,
      desc: "Flagged for physical laboratory microscopy or soil tissue testing before advisory."
    }
  ];

  return (
    <section className="landing-section landing-section-alt" id="expert-validation">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <ExpertIcon size={14} color="var(--agri-primary)" />
            <span>Human-in-the-Loop Integrity</span>
          </div>
          <h2 className="section-title">
            AI + Human Expertise.
          </h2>
          <p className="section-desc">
            Artificial intelligence provides rapid field screening, but human agronomists provide trusted validation. High-stakes and ambiguous cases route to agricultural officers for verified review.
          </p>
        </div>

        <div className="expert-layout-grid">
          {/* Left Column: Visual Pipeline */}
          <div className="expert-flow-box">
            <div className="expert-flow-item">
              <div className="expert-item-icon" style={{ background: "rgba(20, 83, 45, 0.1)", color: "var(--agri-primary)" }}>
                <CpuIcon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--agri-primary)", textTransform: "uppercase" }}>Stage 01</div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)" }}>AI Initial Prediction</strong>
                <p style={{ fontSize: "0.82rem", color: "var(--agri-text-muted)", margin: "0.2rem 0 0 0" }}>
                  Vision model flags early pathogen signature with confidence score & risk tier.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", color: "var(--agri-text-subtle)", margin: "-0.3rem 0" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </div>

            <div className="expert-flow-item" style={{ borderColor: "var(--agri-primary)", background: "#ffffff" }}>
              <div className="expert-item-icon" style={{ background: "var(--agri-primary)", color: "#ffffff" }}>
                <ExpertIcon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--agri-primary)", textTransform: "uppercase" }}>Stage 02</div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)" }}>Agronomist & KVK Expert Review</strong>
                <p style={{ fontSize: "0.82rem", color: "var(--agri-text-muted)", margin: "0.2rem 0 0 0" }}>
                  Specialists review the image alongside localized weather, variety, and stage.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", color: "var(--agri-text-subtle)", margin: "-0.3rem 0" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </div>

            {/* 3 Outcome Branches */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.5rem"
            }}>
              {validationStatuses.map((stat, i) => {
                const StatusIcon = stat.Icon;
                return (
                  <div
                    key={i}
                    style={{
                      background: stat.bg,
                      border: `1px solid ${stat.border}`,
                      borderRadius: "8px",
                      padding: "0.65rem 0.5rem",
                      textAlign: "center"
                    }}
                  >
                    <StatusIcon size={16} color={stat.color} />
                    <div style={{ fontSize: "0.76rem", fontWeight: 800, color: stat.color, marginTop: "0.25rem" }}>
                      {stat.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "center", color: "var(--agri-text-subtle)", margin: "-0.3rem 0" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </div>

            <div className="expert-flow-item" style={{ background: "var(--agri-accent-subtle)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              <div className="expert-item-icon" style={{ background: "var(--agri-primary)", color: "#ffffff" }}>
                <DatabaseIcon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--agri-primary)", textTransform: "uppercase" }}>Stage 03</div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)" }}>Verified Field Ground-Truth</strong>
                <p style={{ fontSize: "0.82rem", color: "var(--agri-text-muted)", margin: "0.2rem 0 0 0" }}>
                  Validated observations fuel active learning datasets and ground-truth knowledge bases.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Narrative Explanations */}
          <div>
            <h3 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--agri-dark)", marginBottom: "1rem", lineHeight: 1.35 }}>
              Expert validation ensures reliability and creates higher-quality field data.
            </h3>
            <p style={{ fontSize: "0.95rem", color: "var(--agri-text-muted)", lineHeight: 1.65, marginBottom: "1.5rem" }}>
              Standalone computer vision can be misled by atypical symptoms, leaf glare, or concurrent nutrient deficiencies. Agri-AI integrates a dedicated portal for extension officers and agricultural universities to review ambiguous diagnoses before costly treatments are deployed.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "var(--agri-accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--agri-primary)", flexShrink: 0, marginTop: "2px" }}>
                  <ShieldCheckIcon size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: "0.92rem", color: "var(--agri-dark)", display: "block" }}>
                    Reduces Treatment Misapplication
                  </strong>
                  <span style={{ fontSize: "0.84rem", color: "var(--agri-text-muted)", lineHeight: 1.5 }}>
                    Prevents farmers from spraying expensive synthetic fungicides when discoloration is actually caused by zinc or nitrogen deficiency.
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "var(--agri-accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--agri-primary)", flexShrink: 0, marginTop: "2px" }}>
                  <RefreshCwIcon size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: "0.92rem", color: "var(--agri-dark)", display: "block" }}>
                    Continuous Model Retraining Loop
                  </strong>
                  <span style={{ fontSize: "0.84rem", color: "var(--agri-text-muted)", lineHeight: 1.5 }}>
                    Validated cases are anonymized and fed back into training pipelines to expand model accuracy on regional crop cultivars and seasonal variations.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
