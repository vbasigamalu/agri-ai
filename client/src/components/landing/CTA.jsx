import React from "react";
import { CameraIcon, ArrowRightIcon, ShieldCheckIcon } from "../Icons";

export default function CTA({ onAnalyzeCrop, onExplorePlatform, onLogin }) {
  return (
    <section className="landing-section" style={{ paddingTop: "2rem", paddingBottom: "5rem" }}>
      <div className="landing-container">
        <div className="cta-banner">
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            padding: "0.4rem 1rem",
            borderRadius: "50px",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#d1fae5",
            marginBottom: "1.5rem"
          }}>
            <ShieldCheckIcon size={16} color="#d1fae5" />
            <span>Field-Ready Decision Support for Every Farmer</span>
          </div>

          <h2>Turn Crop Data into Timely Decisions.</h2>
          <p>
            Upload a crop image, understand the risk, and get actionable crop-health guidance tailored to your local field conditions.
          </p>

          <div className="cta-btn-group">
            <button
              className="btn btn-primary"
              onClick={onAnalyzeCrop}
              style={{
                background: "#ffffff",
                color: "var(--agri-dark)",
                border: "none",
                fontWeight: 800,
                padding: "0.95rem 2rem",
                boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15)"
              }}
            >
              <CameraIcon size={18} color="var(--agri-primary)" />
              <span>Analyze Your Crop</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={onExplorePlatform}
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                borderColor: "rgba(255, 255, 255, 0.3)",
                fontWeight: 700,
                padding: "0.95rem 1.85rem"
              }}
            >
              <span>Explore the Platform</span>
              <ArrowRightIcon size={16} />
            </button>

            {onLogin && (
              <button
                className="btn btn-secondary"
                onClick={onLogin}
                style={{
                  background: "rgba(255, 255, 255, 0.18)",
                  color: "#ffffff",
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  fontWeight: 700,
                  padding: "0.95rem 1.85rem"
                }}
              >
                <span>Login to Account</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

