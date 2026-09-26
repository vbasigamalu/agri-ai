import React from "react";
import {
  MicroscopeIcon,
  PestIcon,
  CloudSunIcon,
  TrendingUpIcon,
  MapIcon,
  GlobeIcon,
  MessageIcon,
  ExpertIcon,
  SparklesIcon
} from "../Icons";

export default function FeatureGrid() {
  const features = [
    {
      id: "disease",
      title: "AI Crop Disease Detection",
      desc: "Analyze crop images using a custom computer-vision model to identify possible diseases.",
      Icon: MicroscopeIcon
    },
    {
      id: "pest",
      title: "Pest Detection & Monitoring",
      desc: "Identify pests and monitor pest activity using field and trap observations.",
      Icon: PestIcon
    },
    {
      id: "weather",
      title: "Weather-Based Risk Intelligence",
      desc: "Combine temperature, humidity, rainfall and other environmental conditions with crop context.",
      Icon: CloudSunIcon
    },
    {
      id: "forecast",
      title: "Risk Forecasting",
      desc: "Move beyond detection by estimating disease and pest risk based on current and historical conditions.",
      Icon: TrendingUpIcon
    },
    {
      id: "hotspots",
      title: "Geospatial Hotspot Mapping",
      desc: "Visualize disease and pest concentration across geographic areas to support targeted monitoring.",
      Icon: MapIcon
    },
    {
      id: "multilingual",
      title: "Multilingual Advisory",
      desc: "Deliver understandable crop-health guidance in the farmer's preferred language.",
      Icon: GlobeIcon
    },
    {
      id: "chatbot",
      title: "AI Crop Health Chatbot",
      desc: "Ask follow-up questions about the analyzed crop and receive context-aware assistance.",
      Icon: MessageIcon
    },
    {
      id: "expert",
      title: "Expert Validation & Learning",
      desc: "Allow validated field observations to improve future monitoring and model development.",
      Icon: ExpertIcon
    }
  ];

  return (
    <section className="landing-section landing-section-alt" id="features">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <SparklesIcon size={14} color="var(--agri-primary)" />
            <span>Platform Capabilities</span>
          </div>
          <h2 className="section-title">Engineered for Resilient Agriculture.</h2>
          <p className="section-desc">
            Eight integrated capabilities designed to empower rural farmers, agronomists, and government extension workers with institutional-grade decision support.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((feat) => {
            const FeatIcon = feat.Icon;
            return (
              <div key={feat.id} className="feature-card">
                <div className="feature-icon-box">
                  <FeatIcon size={24} />
                </div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
