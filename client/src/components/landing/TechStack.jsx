import React from "react";
import {
  CodeIcon,
  ServerIcon,
  CpuIcon,
  DatabaseIcon,
  BrainIcon,
  TerminalIcon,
  CheckCircleIcon
} from "../Icons";

export default function TechStack() {
  const techCategories = [
    {
      title: "Frontend Client",
      Icon: CodeIcon,
      tags: ["React 18", "Vite", "Tailwind CSS", "PWA Offline"],
      desc: "High-performance Progressive Web App with multilingual caching, responsive mobile-first UI, and offline camera synchronization."
    },
    {
      title: "Backend API Layer",
      Icon: ServerIcon,
      tags: ["Node.js", "Express.js", "REST APIs", "JWT Auth"],
      desc: "Robust micro-service architecture handling multi-tenant farmer data, case pipelines, and asynchronous weather polling."
    },
    {
      title: "AI & Computer Vision",
      Icon: CpuIcon,
      tags: ["PyTorch", "Computer Vision", "ONNX Runtime", "VLM Reasoner"],
      desc: "Edge-optimized lightweight inference models with ONNX Runtime acceleration and multimodal Vision-Language reasoning."
    },
    {
      title: "Data & Geospatial",
      Icon: DatabaseIcon,
      tags: ["PostgreSQL", "PostGIS", "pgvector", "DBSCAN"],
      desc: "Spatial coordinate indexing with PostGIS for radius clustering, vector embeddings with pgvector for disease semantics."
    },
    {
      title: "Intelligence & Advisory",
      Icon: BrainIcon,
      tags: ["Risk Engine", "Decision Engine", "RAG Pipeline", "Multilingual LLM"],
      desc: "Rule-based agricultural decision engine blended with retrieval-augmented generation grounded in ICAR university bulletins."
    },
    {
      title: "Infrastructure & Queue",
      Icon: TerminalIcon,
      tags: ["Docker", "Redis", "Background Jobs", "Cron Watcher"],
      desc: "Containerized deployments, Redis cache for rapid microclimate lookups, and queued scheduled workers for follow-up reminders."
    }
  ];

  return (
    <section className="landing-section" id="technology">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <TerminalIcon size={14} color="var(--agri-primary)" />
            <span>Robust Engineering Architecture</span>
          </div>
          <h2 className="section-title">
            Built on a Modern, Resilient Tech Stack.
          </h2>
          <p className="section-desc">
            Engineered for real-world agricultural conditions. Agri-AI blends edge-ready computer vision, geospatial intelligence, and low-latency cloud infrastructure.
          </p>
        </div>

        <div className="tech-grid">
          {techCategories.map((cat, idx) => {
            const GroupIcon = cat.Icon;
            return (
              <div key={idx} className="tech-group-card">
                <div className="tech-group-title">
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "var(--agri-accent-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--agri-primary)"
                  }}>
                    <GroupIcon size={16} />
                  </div>
                  <span>{cat.title}</span>
                </div>

                <div className="tech-tags-list" style={{ marginBottom: "1rem" }}>
                  {cat.tags.map((tag, tIdx) => (
                    <span key={tIdx} className="tech-tag">
                      {tag}
                    </span>
                  ))}
                </div>

                <p style={{ fontSize: "0.86rem", color: "var(--agri-text-muted)", lineHeight: 1.55, margin: 0 }}>
                  {cat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
