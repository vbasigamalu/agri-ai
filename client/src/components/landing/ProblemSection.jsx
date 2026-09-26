import React from "react";
import {
  ClockIcon,
  ExpertIcon,
  CloudSunIcon,
  MapIcon,
  AlertTriangleIcon
} from "../Icons";

export default function ProblemSection() {
  const problems = [
    {
      num: "01",
      title: "Late Detection",
      desc: "Visible symptoms may appear after crop damage has already progressed, making curative treatment costly or ineffective.",
      Icon: ClockIcon
    },
    {
      num: "02",
      title: "Limited Expert Access",
      desc: "Farmers may not always have immediate access to certified agronomists, extension officers, or laboratory diagnosis.",
      Icon: ExpertIcon
    },
    {
      num: "03",
      title: "Changing Field Conditions",
      desc: "Weather, crop stage, and local microclimates dynamically influence disease life cycles and pest proliferation risk.",
      Icon: CloudSunIcon
    },
    {
      num: "04",
      title: "Lack of Local Intelligence",
      desc: "Isolated field reports are rarely connected into broader geographic patterns, allowing regional outbreaks to spread undetected.",
      Icon: MapIcon
    }
  ];

  return (
    <section className="landing-section landing-section-alt" id="about">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <AlertTriangleIcon size={14} color="var(--agri-primary)" />
            <span>The Agricultural Challenge</span>
          </div>
          <h2 className="section-title">
            Crop Problems Can Spread Before They Are Clearly Visible.
          </h2>
          <p className="section-desc">
            Traditional crop health management is often purely reactive. Delayed diagnosis and lack of regional surveillance cost growers critical days when pathogens take hold.
          </p>
        </div>

        <div className="problem-grid">
          {problems.map((item) => {
            const ProblemIcon = item.Icon;
            return (
              <div key={item.num} className="problem-card">
                <span className="problem-num">{item.num}</span>
                <div className="problem-icon-wrap">
                  <ProblemIcon size={22} color="var(--agri-red)" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
