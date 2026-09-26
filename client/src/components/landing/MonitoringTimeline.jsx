import React, { useState } from "react";
import {
  CalendarIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  CameraIcon,
  ActivityIcon,
  ArrowRightIcon
} from "../Icons";

export default function MonitoringTimeline() {
  const [selectedDay, setSelectedDay] = useState(10);

  const timelineSteps = [
    {
      day: 1,
      dayLabel: "Day 01",
      title: "Initial Analysis & Baseline",
      status: "Baseline Established",
      statusType: "stable",
      imageTag: "Early Blight - 91% Confidence",
      desc: "Farmer captures the first symptomatic leaf image. Agri-AI identifies Early Blight with moderate risk, generates targeted bio-fungicide advisory, and schedules a 5-day surveillance window.",
      actions: [
        "Pathogen signature recorded",
        "Weather context correlated (RH: 86%)",
        "Targeted treatment plan assigned",
        "Follow-up reminder scheduled"
      ],
      progressVal: "30%"
    },
    {
      day: 5,
      dayLabel: "Day 05",
      title: "Follow-up Image & Response Check",
      status: "Treatment Applied",
      statusType: "improving",
      imageTag: "Lesion Margin Check",
      desc: "Farmer submits a secondary follow-up image of the treated plant canopy. The vision engine measures lesion margin stabilization and cross-verifies whether fungal sporulation has halted.",
      actions: [
        "Copper oxychloride treatment logged",
        "Concentric lesion spread arrested",
        "No secondary chlorosis detected",
        "Day 10 recovery assessment queued"
      ],
      progressVal: "65%"
    },
    {
      day: 10,
      dayLabel: "Day 10",
      title: "Updated Crop Status & Outcome",
      status: "Improving",
      statusType: "improving",
      imageTag: "New Foliar Growth Clean",
      desc: "Final follow-up assessment compares the full 10-day image sequence. New vegetative shoots demonstrate zero active pathogen spread, confirming successful localized intervention.",
      actions: [
        "Vigor score recovered to +82%",
        "Ground-truth observation recorded",
        "Case logged to regional database",
        "Pest & disease monitoring closed"
      ],
      progressVal: "100%"
    }
  ];

  return (
    <section className="landing-section" id="monitoring">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <RefreshCwIcon size={14} color="var(--agri-primary)" />
            <span>Longitudinal Crop Surveillance</span>
          </div>
          <h2 className="section-title">
            Don't Stop at the First Diagnosis.
          </h2>
          <p className="section-desc">
            Crop health is dynamic. Follow-up observations track how the crop condition changes over time, verifying whether treatments succeeded or if secondary intervention is required.
          </p>
        </div>

        {/* Status Indicators Pill Bar */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "2.5rem",
          flexWrap: "wrap"
        }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--agri-text-muted)" }}>
            Surveillance States:
          </span>
          <span className="timeline-status-badge improving">
            <CheckCircleIcon size={14} color="var(--agri-primary)" />
            Improving (Pathogen Arrested)
          </span>
          <span className="timeline-status-badge stable">
            <ActivityIcon size={14} color="var(--agri-amber)" />
            Stable (Under Observation)
          </span>
          <span className="timeline-status-badge attention">
            <AlertTriangleIcon size={14} color="var(--agri-red)" />
            Needs Attention (Secondary Spread)
          </span>
        </div>

        {/* 3-Stage Interactive Timeline Grid */}
        <div className="timeline-stages-grid">
          {timelineSteps.map((step) => {
            const isSelected = selectedDay === step.day;
            return (
              <div
                key={step.day}
                className="timeline-card"
                onClick={() => setSelectedDay(step.day)}
                style={{
                  cursor: "pointer",
                  borderColor: isSelected ? "var(--agri-primary)" : "var(--agri-border)",
                  boxShadow: isSelected ? "var(--agri-shadow-md)" : "var(--agri-shadow)",
                  transform: isSelected ? "translateY(-4px)" : "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span className="timeline-day-pill">{step.dayLabel}</span>
                  <span className={`timeline-status-badge ${step.statusType}`}>
                    {step.statusType === "improving" ? (
                      <CheckCircleIcon size={13} color="currentColor" />
                    ) : (
                      <ActivityIcon size={13} color="currentColor" />
                    )}
                    {step.status}
                  </span>
                </div>

                <h3>{step.title}</h3>
                <p style={{ fontSize: "0.88rem", color: "var(--agri-text-muted)", lineHeight: 1.55, marginBottom: "1rem" }}>
                  {step.desc}
                </p>

                <div style={{
                  background: "var(--agri-bg-cream)",
                  border: "1px solid var(--agri-border)",
                  borderRadius: "8px",
                  padding: "0.85rem",
                  marginBottom: "1rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--agri-dark)", marginBottom: "0.45rem" }}>
                    <CameraIcon size={14} color="var(--agri-primary)" />
                    <span>Observation Metadata: {step.imageTag}</span>
                  </div>
                  <ul style={{ paddingLeft: "1.1rem", margin: 0, fontSize: "0.78rem", color: "var(--agri-text-muted)", lineHeight: 1.6 }}>
                    {step.actions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.76rem", color: "var(--agri-text-subtle)", paddingTop: "0.5rem", borderTop: "1px solid var(--agri-border)" }}>
                  <span>Progression Window</span>
                  <span style={{ fontWeight: 700, color: "var(--agri-primary)" }}>{step.progressVal}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Database Architecture Flow Note */}
        <div style={{
          marginTop: "2.5rem",
          background: "linear-gradient(135deg, #ffffff 0%, var(--agri-bg-cream) 100%)",
          border: "1px solid var(--agri-border)",
          borderRadius: "var(--agri-radius)",
          padding: "1.25rem 1.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1.25rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--agri-accent-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--agri-primary)"
            }}>
              <CalendarIcon size={18} />
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--agri-dark)" }}>
                Database-Driven Case Lifecycle
              </strong>
              <span style={{ fontSize: "0.82rem", color: "var(--agri-text-muted)" }}>
                Schema: <code style={{ color: "var(--agri-primary)", background: "rgba(20,83,45,0.06)", padding: "2px 6px", borderRadius: "4px" }}>cases → followups → images → predictions → treatments → observations</code>
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--agri-primary)" }}>
            <span>Automated SMS & In-App Follow-up Alerts</span>
            <ArrowRightIcon size={14} />
          </div>
        </div>
      </div>
    </section>
  );
}
