import React from "react";
import {
  CameraIcon,
  CheckCircleIcon,
  LeafIcon,
  MicroscopeIcon,
  SparklesIcon,
  ShieldIcon,
  BrainIcon
} from "../Icons";

export default function VisionSection() {
  const pipelineSteps = [
    {
      title: "Crop Image",
      desc: "Raw optical capture",
      Icon: CameraIcon
    },
    {
      title: "Quality Check",
      desc: "Blur & lighting gating",
      Icon: CheckCircleIcon
    },
    {
      title: "Leaf / Plant Analysis",
      desc: "Foreground foliar isolation",
      Icon: LeafIcon
    },
    {
      title: "Custom Vision Model",
      desc: "PyTorch ONNX classifier",
      Icon: MicroscopeIcon
    },
    {
      title: "Pathogen Prediction",
      desc: "Confidence & entropy score",
      Icon: SparklesIcon
    },
    {
      title: "Context Verification",
      desc: "Weather & host alignment",
      Icon: ShieldIcon
    }
  ];

  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <MicroscopeIcon size={14} color="var(--agri-primary)" />
            <span>Computer Vision Architecture</span>
          </div>
          <h2 className="section-title">AI That Looks Beyond the Image.</h2>
          <p className="section-desc">
            A crop photograph in natural sunlight carries noise, shadows, and soil clutter. Our vision pipeline isolates the biological surface before inference, preventing background bias from misguiding diagnoses.
          </p>
        </div>

        {/* 6-Stage Visual Pipeline Nodes */}
        <div className="vision-pipeline-row">
          {pipelineSteps.map((step, idx) => {
            const StepIcon = step.Icon;
            return (
              <React.Fragment key={step.title}>
                <div className="pipeline-node">
                  <div className="pipeline-node-icon">
                    <StepIcon size={20} />
                  </div>
                  <strong>{step.title}</strong>
                  <span>{step.desc}</span>
                </div>
                {idx < pipelineSteps.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", color: "var(--agri-border-hover)", fontWeight: 700 }}>
                    &rarr;
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Vision-Language Intelligence Callout */}
        <div className="vlm-callout-card">
          <div className="vlm-info-left">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <BrainIcon size={18} color="var(--agri-primary)" />
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--agri-primary)", textTransform: "uppercase" }}>
                Multimodal Reasoning
              </span>
            </div>
            <h4>Visual Understanding (Vision-Language Intelligence)</h4>
            <p>
              Optional vision-language intelligence can interpret visible symptoms and support image-aware conversations. It articulates lesion morphology, chlorosis patterns, and physiological stress indicators to give farmers grounded, explainable reasoning without making unverified accuracy claims.
            </p>
          </div>
          <div style={{ background: "var(--agri-card)", padding: "0.75rem 1.25rem", borderRadius: "10px", border: "1px solid var(--agri-border)", fontSize: "0.82rem", color: "var(--agri-text-muted)" }}>
            <strong style={{ color: "var(--agri-dark)", display: "block", marginBottom: "0.25rem" }}>Explainable Output:</strong>
            Foliar boundary detection · Concentric rings check · Vein chlorosis
          </div>
        </div>
      </div>
    </section>
  );
}
