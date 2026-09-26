import React from "react";
import {
  LayersIcon,
  CpuIcon,
  ServerIcon,
  SmartphoneIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  RefreshCwIcon,
  MessageSquareIcon,
  ActivityIcon,
  PestIcon,
  LeafIcon,
  EyeIcon,
  CloudSunIcon,
  MapIcon
} from "../Icons";

export default function Architecture() {
  const dataLayerItems = [
    { label: "Disease Detection", Icon: LeafIcon, type: "CV Model" },
    { label: "Pest Detection", Icon: PestIcon, type: "Trap Vision" },
    { label: "VLM Reasoning", Icon: EyeIcon, type: "Multimodal" },
    { label: "Weather Feeds", Icon: CloudSunIcon, type: "Open-Meteo" },
    { label: "Historical Records", Icon: DatabaseIcon, type: "PostgreSQL" },
    { label: "Pest-Trap Sensor", Icon: ActivityIcon, type: "Telemetry" },
    { label: "Geospatial Data", Icon: MapIcon, type: "PostGIS" }
  ];

  return (
    <section className="landing-section landing-section-alt" id="architecture">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <LayersIcon size={14} color="var(--agri-primary)" />
            <span>End-to-End System Design</span>
          </div>
          <h2 className="section-title">
            The Agri-AI System Flow.
          </h2>
          <p className="section-desc">
            From the farmer's camera to laboratory-grade advisory and closed-loop model enhancement. A unified, asynchronous pipeline engineered for real-time agricultural surveillance.
          </p>
        </div>

        <div className="arch-diagram-wrapper">
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: "920px",
            margin: "0 auto",
            gap: "1.25rem",
            position: "relative"
          }}>
            {/* Stage 1: Farmer */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "var(--agri-primary)",
              color: "#ffffff",
              padding: "0.85rem 2.25rem",
              borderRadius: "50px",
              boxShadow: "0 4px 15px rgba(20, 83, 45, 0.25)",
              fontWeight: 800,
              fontSize: "0.95rem",
              letterSpacing: "0.04em"
            }}>
              <span>FARMER & FIELD OBSERVER</span>
            </div>

            {/* Vertical Flow Line */}
            <div style={{ width: "2px", height: "24px", background: "var(--agri-border)", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "var(--agri-primary)", animation: "pulseBeacon 2s infinite" }} />
            </div>

            {/* Stage 2: Web / PWA */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "#ffffff",
              border: "1px solid var(--agri-border)",
              borderRadius: "var(--agri-radius)",
              padding: "0.85rem 1.75rem",
              boxShadow: "var(--agri-shadow)",
              width: "100%",
              maxWidth: "520px",
              justifyContent: "center"
            }}>
              <SmartphoneIcon size={20} color="var(--agri-primary)" />
              <div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)", display: "block" }}>
                  CLIENT INTERFACE (PWA / WEB)
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--agri-text-muted)" }}>
                  Multilingual UI • Camera Capture • Offline Cache
                </span>
              </div>
            </div>

            {/* Vertical Flow Line */}
            <div style={{ width: "2px", height: "24px", background: "var(--agri-border)" }} />

            {/* Stage 3: API Layer */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "#ffffff",
              border: "1px solid var(--agri-border)",
              borderRadius: "var(--agri-radius)",
              padding: "0.85rem 1.75rem",
              boxShadow: "var(--agri-shadow)",
              width: "100%",
              maxWidth: "520px",
              justifyContent: "center"
            }}>
              <ServerIcon size={20} color="var(--agri-primary)" />
              <div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)", display: "block" }}>
                  API GATEWAY & SERVICE LAYER
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--agri-text-muted)" }}>
                  Node.js / Express • Auth • Payload Validation • Rate Limiting
                </span>
              </div>
            </div>

            {/* Vertical Flow Line */}
            <div style={{ width: "2px", height: "24px", background: "var(--agri-border)" }} />

            {/* Stage 4: AI & Data Layer (Multi-branch Grid) */}
            <div style={{
              background: "var(--agri-bg-cream)",
              border: "1.5px dashed var(--agri-primary)",
              borderRadius: "var(--agri-radius-lg)",
              padding: "1.5rem",
              width: "100%"
            }}>
              <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
                <span style={{
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "var(--agri-primary)",
                  letterSpacing: "0.06em",
                  background: "#ffffff",
                  padding: "0.35rem 1rem",
                  borderRadius: "9999px",
                  border: "1px solid var(--agri-border)"
                }}>
                  AI & MULTI-SOURCE DATA LAYER
                </span>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.75rem"
              }}>
                {dataLayerItems.map((item, i) => {
                  const ItemIcon = item.Icon;
                  return (
                    <div
                      key={i}
                      style={{
                        background: "#ffffff",
                        border: "1px solid var(--agri-border)",
                        borderRadius: "8px",
                        padding: "0.85rem 0.5rem",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.35rem"
                      }}
                    >
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "6px",
                        background: "var(--agri-bg-alt)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--agri-primary)"
                      }}>
                        <ItemIcon size={16} />
                      </div>
                      <strong style={{ fontSize: "0.8rem", color: "var(--agri-dark)", lineHeight: 1.2 }}>
                        {item.label}
                      </strong>
                      <span style={{ fontSize: "0.72rem", color: "var(--agri-text-subtle)" }}>
                        {item.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vertical Flow Line */}
            <div style={{ width: "2px", height: "24px", background: "var(--agri-border)" }} />

            {/* Stage 5: Risk Engine */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "#ffffff",
              border: "1px solid var(--agri-border)",
              borderRadius: "var(--agri-radius)",
              padding: "0.85rem 1.75rem",
              boxShadow: "var(--agri-shadow)",
              width: "100%",
              maxWidth: "520px",
              justifyContent: "center"
            }}>
              <ActivityIcon size={20} color="var(--agri-amber)" />
              <div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)", display: "block" }}>
                  CONTEXT-AWARE RISK ENGINE
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--agri-text-muted)" }}>
                  Aggregates Environmental Multipliers • Epidemiological Risk Scoring
                </span>
              </div>
            </div>

            {/* Vertical Flow Line */}
            <div style={{ width: "2px", height: "24px", background: "var(--agri-border)" }} />

            {/* Stage 6: Decision Engine */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "#ffffff",
              border: "1px solid var(--agri-border)",
              borderRadius: "var(--agri-radius)",
              padding: "0.85rem 1.75rem",
              boxShadow: "var(--agri-shadow)",
              width: "100%",
              maxWidth: "520px",
              justifyContent: "center"
            }}>
              <CpuIcon size={20} color="var(--agri-primary)" />
              <div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)", display: "block" }}>
                  AGRONOMIC DECISION ENGINE
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--agri-text-muted)" }}>
                  Rule Matrices + RAG Knowledge Synthesis • ICAR Guidelines
                </span>
              </div>
            </div>

            {/* Vertical Flow Line */}
            <div style={{ width: "2px", height: "24px", background: "var(--agri-border)" }} />

            {/* Stage 7: Advisory + Chatbot + Alerts */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "var(--agri-accent-subtle)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "var(--agri-radius)",
              padding: "0.85rem 1.75rem",
              width: "100%",
              maxWidth: "520px",
              justifyContent: "center"
            }}>
              <MessageSquareIcon size={20} color="var(--agri-primary)" />
              <div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)", display: "block" }}>
                  MULTILINGUAL ADVISORY • CHATBOT • SMS ALERTS
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--agri-text-muted)" }}>
                  Marathi, Hindi, English • Actionable Steps • WhatsApp/SMS Alerts
                </span>
              </div>
            </div>

            {/* Vertical Flow Line */}
            <div style={{ width: "2px", height: "24px", background: "var(--agri-border)" }} />

            {/* Stage 8: Follow-up & Feedback */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "#ffffff",
              border: "1px solid var(--agri-border)",
              borderRadius: "var(--agri-radius)",
              padding: "0.85rem 1.75rem",
              boxShadow: "var(--agri-shadow)",
              width: "100%",
              maxWidth: "520px",
              justifyContent: "center"
            }}>
              <RefreshCwIcon size={20} color="var(--agri-primary)" />
              <div>
                <strong style={{ fontSize: "0.95rem", color: "var(--agri-dark)", display: "block" }}>
                  LONGITUDINAL FOLLOW-UP MONITORING
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--agri-text-muted)" }}>
                  Day 5 / Day 10 image comparison • Treatment efficacy tracking
                </span>
              </div>
            </div>

            {/* Vertical Flow Line */}
            <div style={{ width: "2px", height: "24px", background: "var(--agri-border)" }} />

            {/* Stage 9: Expert Validation & Active Learning */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              background: "linear-gradient(135deg, #ffffff 0%, var(--agri-bg-cream) 100%)",
              border: "1px solid var(--agri-border)",
              borderRadius: "var(--agri-radius-lg)",
              padding: "1.25rem 2rem",
              boxShadow: "var(--agri-shadow)",
              width: "100%",
              maxWidth: "680px",
              justifyContent: "space-between",
              flexWrap: "wrap"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <ShieldCheckIcon size={22} color="var(--agri-primary)" />
                <div>
                  <strong style={{ fontSize: "0.92rem", color: "var(--agri-dark)", display: "block" }}>
                    EXPERT VALIDATION & BIOSECURITY SURVEILLANCE
                  </strong>
                  <span style={{ fontSize: "0.78rem", color: "var(--agri-text-muted)" }}>
                    KVK Agronomist review of flagged and clustered anomalies
                  </span>
                </div>
              </div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.76rem",
                fontWeight: 800,
                color: "var(--agri-primary)",
                background: "var(--agri-accent-subtle)",
                padding: "0.35rem 0.85rem",
                borderRadius: "9999px"
              }}>
                <RefreshCwIcon size={12} />
                <span>CONTINUOUS LEARNING LOOP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
