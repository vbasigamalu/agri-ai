import React from "react";
import {
  UserIcon,
  CameraIcon,
  MicroscopeIcon,
  CloudSunIcon,
  TrendingUpIcon,
  MapIcon,
  BrainIcon,
  GlobeIcon,
  MessageIcon,
  LayersIcon
} from "../Icons";

export default function SolutionFlow() {
  const steps = [
    {
      num: 1,
      title: "Farmer Capture",
      desc: "Farmer captures foliar anomalies or pest trap cards using mobile camera in the field.",
      Icon: UserIcon
    },
    {
      num: 2,
      title: "Crop & Field Metadata",
      desc: "Device coordinates, crop species, and growth stage parsed alongside image pixels.",
      Icon: CameraIcon
    },
    {
      num: 3,
      title: "Dual AI Vision Detection",
      desc: "Edge-optimized ONNX model and YOLOv8 classify pathogen lesions and insect counts.",
      Icon: MicroscopeIcon
    },
    {
      num: 4,
      title: "Environmental Context",
      desc: "Real-time temperature, relative humidity, and rainfall synced for microclimate evaluation.",
      Icon: CloudSunIcon
    },
    {
      num: 5,
      title: "Predictive Risk Forecasting",
      desc: "XGBoost models calculate disease incubation velocity for the upcoming 1–7 days.",
      Icon: TrendingUpIcon
    },
    {
      num: 6,
      title: "Geospatial Clustering",
      desc: "PostGIS DBSCAN identifies regional infection hotspots without storing farmer PII.",
      Icon: MapIcon
    },
    {
      num: 7,
      title: "Decision Rules Engine",
      desc: "Synthesizes severity score, weather window, and Economic Threshold Limits (ETL).",
      Icon: BrainIcon
    },
    {
      num: 8,
      title: "Multilingual Advisory",
      desc: "Delivers CIB&RC approved chemical, biological, and cultural steps in Marathi, Hindi, English.",
      Icon: GlobeIcon
    },
    {
      num: 9,
      title: "AI Chatbot & Follow-up",
      desc: "Farmer asks clarifying questions and schedules Day 5 re-inspection to verify recovery.",
      Icon: MessageIcon
    }
  ];

  return (
    <section className="landing-section" id="how-it-works">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <LayersIcon size={14} color="var(--agri-primary)" />
            <span>End-to-End Decision Architecture</span>
          </div>
          <h2 className="section-title">From Detection to Decision.</h2>
          <p className="section-desc">
            Agri-AI bridges raw optical leaf imagery with localized environmental context and institutional agronomic guidelines — turning diagnostics into actionable biosecurity.
          </p>
        </div>

        {/* 9-Stage Connected Workflow Cards */}
        <div className="solution-flow-list">
          {steps.map((s) => {
            const StepIcon = s.Icon;
            return (
              <div key={s.num} className="flow-step-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
                  <div className="flow-step-badge">{s.num}</div>
                  <div style={{ color: "var(--agri-primary)" }}>
                    <StepIcon size={20} />
                  </div>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
