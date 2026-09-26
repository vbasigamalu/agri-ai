import React from "react";
import {
  LeafIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  SparklesIcon,
  ThermometerIcon,
  DropletIcon,
  CloudSunIcon,
  LocationPinIcon,
  CameraIcon,
  MicroscopeIcon
} from "../Icons";

export default function Hero({ onAnalyzeCrop, onExploreHowItWorks, onLogin }) {
  return (
    <section className="hero-section" id="hero">
      <div className="landing-container">
        <div className="hero-grid">
          {/* Left Column: Headlines & CTAs */}
          <div className="hero-content">
            <div className="hero-trust-tag">
              <SparklesIcon size={14} color="var(--agri-primary)" />
              <span>Intelligent Crop Biosecurity &amp; Diagnostics</span>
            </div>

            <h1 className="hero-title">
              Smarter Crop Health Starts with <span>Early Detection.</span>
            </h1>

            <p className="hero-subtitle">
              Agri-AI combines computer vision, environmental intelligence, pest monitoring and AI-powered advisory to help farmers detect crop problems early and take informed action.
            </p>

            <div className="hero-cta-group">
              <button
                type="button"
                onClick={onAnalyzeCrop}
                className="agri-btn agri-btn-primary agri-btn-lg"
                id="hero-btn-analyze"
              >
                <CameraIcon size={18} />
                <span>Analyze Your Crop</span>
                <ArrowRightIcon size={16} />
              </button>

              <button
                type="button"
                onClick={onExploreHowItWorks}
                className="agri-btn agri-btn-secondary agri-btn-lg"
                id="hero-btn-explore"
              >
                <span>Explore How It Works</span>
              </button>
            </div>

            {onLogin && (
              <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", color: "var(--agri-text-muted)" }}>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={onLogin}
                  id="hero-login-link"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--agri-primary)",
                    fontWeight: 800,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                    fontSize: "0.88rem"
                  }}
                >
                  Farmer / Officer Login →
                </button>
              </div>
            )}

            {/* Trust Statement */}
            <div className="hero-trust-pills">
              <div className="trust-item">
                <CheckCircleIcon size={14} color="var(--agri-primary)" />
                <span>AI-powered</span>
              </div>
              <span style={{ opacity: 0.3 }}>•</span>
              <div className="trust-item">
                <CheckCircleIcon size={14} color="var(--agri-primary)" />
                <span>Multilingual</span>
              </div>
              <span style={{ opacity: 0.3 }}>•</span>
              <div className="trust-item">
                <CheckCircleIcon size={14} color="var(--agri-primary)" />
                <span>Context-aware</span>
              </div>
              <span style={{ opacity: 0.3 }}>•</span>
              <div className="trust-item">
                <CheckCircleIcon size={14} color="var(--agri-primary)" />
                <span>Farmer-focused</span>
              </div>
            </div>
          </div>

          {/* Right Column: Sophisticated Agricultural Dashboard Visualization */}
          <div className="hero-visual-card">
            {/* Header bar */}
            <div className="hero-card-header">
              <div className="hero-card-header-left">
                <span className="pulse-dot" />
                <span>Active Crop Health Telemetry</span>
              </div>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--agri-primary)", background: "var(--agri-accent-subtle)", padding: "0.2rem 0.55rem", borderRadius: "4px" }}>
                Live Field Scan
              </span>
            </div>

            {/* Simulated leaf scanning viewport */}
            <div className="hero-card-body">
              <div className="scanner-viewport">
                {/* Clean SVG agricultural leaf illustration */}
                <svg
                  viewBox="0 0 400 220"
                  className="scanner-leaf-bg"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: "100%", height: "100%", background: "#0c2817" }}
                >
                  <defs>
                    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#15803d" />
                      <stop offset="50%" stopColor="#166534" />
                      <stop offset="100%" stopColor="#0f391e" />
                    </linearGradient>
                    <radialGradient id="lesionGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#78350f" />
                      <stop offset="70%" stopColor="#92400e" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#15803d" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  {/* Stylized background leaf veins */}
                  <path
                    d="M 50 190 Q 200 40 360 80 Q 280 180 50 190 Z"
                    fill="url(#leafGrad)"
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    strokeOpacity="0.4"
                  />
                  <path d="M 50 190 Q 200 110 360 80" stroke="#86efac" strokeWidth="1.5" strokeOpacity="0.5" fill="none" />
                  <path d="M 140 145 Q 160 100 190 85" stroke="#86efac" strokeWidth="1" strokeOpacity="0.35" fill="none" />
                  <path d="M 210 120 Q 240 85 270 70" stroke="#86efac" strokeWidth="1" strokeOpacity="0.35" fill="none" />
                  <path d="M 180 160 Q 200 180 240 185" stroke="#86efac" strokeWidth="1" strokeOpacity="0.35" fill="none" />
                  {/* Subtle target foliar lesion spot */}
                  <circle cx="205" cy="115" r="18" fill="url(#lesionGrad)" />
                  <circle cx="205" cy="115" r="8" fill="#451a03" opacity="0.75" />
                  <circle cx="230" cy="135" r="10" fill="url(#lesionGrad)" opacity="0.7" />
                </svg>

                {/* Animated Laser Scanning Line */}
                <div className="scan-laser-line" />

                {/* AI Detection Bounding Box Overlay */}
                <div className="scan-bounding-box">
                  <div className="scan-box-tag">
                    <MicroscopeIcon size={11} color="#042f15" />
                    <span>Foliar Lesion Detected</span>
                  </div>
                </div>
              </div>

              {/* Two Column Diagnostic Meta Dashboard */}
              <div className="hero-dashboard-meta">
                {/* Diagnosis & Confidence Card */}
                <div className="hero-diag-card">
                  <div className="diag-header">Primary Pathogen</div>
                  <div className="diag-name">Tomato Septoria Leaf Spot</div>
                  <div className="diag-pill-row">
                    <span className="pill-confidence">94.2% Conf</span>
                    <span className="pill-risk-moderate">Moderate Risk</span>
                  </div>
                </div>

                {/* Microclimate Weather Context Card */}
                <div className="hero-weather-card">
                  <div className="diag-header" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <CloudSunIcon size={12} color="var(--agri-primary)" />
                    <span>Field Context</span>
                  </div>
                  <div className="weather-stats">
                    <div className="weather-stat-item">
                      <span>Temp</span>
                      <strong>27°C</strong>
                    </div>
                    <div className="weather-stat-item">
                      <span>Humidity</span>
                      <strong>78%</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--agri-primary)", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "3px" }}>
                    <LocationPinIcon size={11} color="var(--agri-primary)" />
                    <span>Sangli Cluster · Action Advised</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategic Workflow Ribbon: IMAGE -> AI ANALYSIS -> RISK -> ACTION */}
            <div className="hero-flow-ribbon">
              <span className="flow-step-tag">1. Image</span>
              <span>&rarr;</span>
              <span className="flow-step-tag">2. AI Vision</span>
              <span>&rarr;</span>
              <span className="flow-step-tag">3. Risk Matrix</span>
              <span>&rarr;</span>
              <span className="flow-step-tag" style={{ color: "var(--agri-dark)", background: "var(--agri-accent-soft)", padding: "0.15rem 0.45rem", borderRadius: "3px" }}>
                4. Actionable Advisory
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
