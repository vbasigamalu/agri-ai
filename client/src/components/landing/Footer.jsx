import React from "react";
import { LeafIcon, ShieldCheckIcon, GlobeIcon } from "../Icons";

export default function Footer({ onNavigate }) {
  const scrollTo = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="footer-grid">
          {/* Brand Col */}
          <div className="footer-brand">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "var(--agri-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#042f15"
              }}>
                <LeafIcon size={18} />
              </div>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
                Agri-AI
              </span>
            </div>
            <p>
              AI-powered crop health intelligence for smarter agricultural decisions. Combining computer vision, environmental context, and vernacular advisory.
            </p>
            <div style={{
              marginTop: "1.25rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.76rem",
              color: "#94a3b8",
              background: "rgba(255, 255, 255, 0.05)",
              padding: "0.35rem 0.75rem",
              borderRadius: "6px"
            }}>
              <GlobeIcon size={13} color="var(--agri-accent)" />
              <span>Multilingual: Marathi • Hindi • English</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li><a href="#home" onClick={scrollTo("home")}>Home</a></li>
              <li><a href="#how-it-works" onClick={scrollTo("how-it-works")}>How It Works</a></li>
              <li><a href="#features" onClick={scrollTo("features")}>Features</a></li>
              <li><a href="#hotspots" onClick={scrollTo("hotspots")}>Risk Monitoring</a></li>
              <li><a href="#about" onClick={scrollTo("about")}>About</a></li>
            </ul>
          </div>

          {/* Technology */}
          <div className="footer-col">
            <h4>Technology</h4>
            <ul>
              <li><a href="#vision" onClick={scrollTo("vision")}>Computer Vision</a></li>
              <li><a href="#context" onClick={scrollTo("context")}>Risk Intelligence</a></li>
              <li><a href="#hotspots" onClick={scrollTo("hotspots")}>Geospatial Monitoring</a></li>
              <li><a href="#assistant" onClick={scrollTo("assistant")}>AI Assistant</a></li>
              <li><a href="#architecture" onClick={scrollTo("architecture")}>System Flow</a></li>
            </ul>
          </div>

          {/* Research & Trust */}
          <div className="footer-col">
            <h4>Validation</h4>
            <ul>
              <li><a href="#expert-validation" onClick={scrollTo("expert-validation")}>Expert Validation</a></li>
              <li><a href="#monitoring" onClick={scrollTo("monitoring")}>Follow-Up Tracking</a></li>
              <li><a href="#technology" onClick={scrollTo("technology")}>Tech Architecture</a></li>
              <li><a href="#impact" onClick={scrollTo("impact")}>Agronomic Impact</a></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div>
            © 2026 Agri-AI. Intelligent Crop Health Surveillance Platform.
          </div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <span>Built for Precision AgriTech & Smallholder Empowerment</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
