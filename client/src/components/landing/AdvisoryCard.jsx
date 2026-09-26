import React, { useState } from "react";
import {
  GlobeIcon,
  CheckCircleIcon,
  ShieldIcon,
  FlaskIcon,
  AlertTriangleIcon,
  ExpertIcon
} from "../Icons";

export default function AdvisoryCard() {
  const [lang, setLang] = useState("mr"); // Default to Marathi to highlight local prominence

  const contentByLang = {
    mr: {
      cropLabel: "पीक: टोमॅटो",
      diseaseLabel: "संभाव्य रोग: अर्ली ब्लाइट (करपा / Alternaria solani)",
      confidence: "९१% अचूकता अंदाज",
      riskText: "मध्यम जोखीम (वातावरणीय अनुकूलता)",
      monitoringTitle: "शिफारशीत निरीक्षण (Monitoring)",
      monitoringText: "खालच्या पानांवरील गोलाकार किंवा लंबगोलाकार तपकिरी डाग तपासा. दर ३ दिवसांनी प्रादुर्भाव वाढीची नोंद घ्या.",
      preventionTitle: "प्रतिबंधात्मक उपाय (Prevention)",
      preventionText: "रोपवाटिकेतून पुनर्लागवड करताना रोपांना ट्रायकोडर्मा व्हिरिडी (Trichoderma viride @ ५ ग्रॅम/लिटर) ची बीजप्रक्रिया करा. तुषार सिंचन टाळून ठिबक सिंचनाचा वापर करा.",
      managementTitle: "व्यवस्थापन व फवारणी (Management Guidance)",
      managementText: "प्रादुर्भावाच्या सुरुवातीला कॉपर ऑक्सिक्लोराईड (५०% WP @ २.५ ग्रॅम/लिटर) किंवा मॅन्कोझेब (७५% WP @ २.० ग्रॅम/लिटर) फवारा. सकाळी ८ ते १० किंवा संध्याकाळी ४ नंतर कोरड्या हवामानात फवारणी करावी.",
      expertTitle: "तज्ज्ञ किंवा प्रयोगशाळा सल्ला केव्हा घ्यावा?",
      expertText: "फवारणीनंतर ५ दिवसांनी डाग वेगाने खोडावर किंवा फळांवर पसरल्यास स्थानिक कृषी विज्ञान केंद्र (KVK) किंवा कृषी अधिकाऱ्यांकडे नमुना पाठवा."
    },
    en: {
      cropLabel: "Crop: Tomato",
      diseaseLabel: "Suspected Condition: Early Blight (Alternaria solani)",
      confidence: "91% Confidence",
      riskText: "Moderate Risk (Environmental Conducive)",
      monitoringTitle: "Recommended Monitoring",
      monitoringText: "Inspect lower foliage for dark brown concentric target-board lesions. Log symptom progression every 3 days to evaluate canopy spread.",
      preventionTitle: "Preventive Cultural Measures",
      preventionText: "Adopt drip irrigation to keep foliar canopy dry. Space plants adequately for airflow and remove lower senescent infected leaves.",
      managementTitle: "Integrated Management & Spray Guidance",
      managementText: "Apply Copper Oxychloride 50% WP @ 2.5 g/L or Mancozeb 75% WP @ 2.0 g/L. Spray during cool morning hours avoiding midday evaporation.",
      expertTitle: "When to Seek Expert / Laboratory Confirmation",
      expertText: "If stem lesions or dark sunken fruit rot develops despite preventive spray within 5 days, escalate to Agronomist queue for lab culture."
    },
    hi: {
      cropLabel: "फसल: टमाटर",
      diseaseLabel: "संभावित रोग: अगेती झुलसा (Early Blight)",
      confidence: "91% आत्मविश्वास",
      riskText: "मध्यम जोखिम (अनुकूल मौसम)",
      monitoringTitle: "अनुशंसित निगरानी (Monitoring)",
      monitoringText: "निचली पत्तियों पर गहरे भूरे रंग के छल्लेदार धब्बों की जांच करें। हर 3 दिन में संक्रमण की गति पर नजर रखें।",
      preventionTitle: "रोकथाम और स्वच्छता (Prevention)",
      preventionText: "ड्रिप सिंचाई का उपयोग करें ताकि पत्तियां सूखी रहें। पौधों के बीच उचित दूरी रखें और संक्रमित पत्तियों को तुरंत नष्ट करें।",
      managementTitle: "प्रबंधन और छिड़काव निर्देश (Management)",
      managementText: "प्रारंभिक अवस्था में कॉपर ऑक्सीक्लोराइड (50% WP @ 2.5 ग्राम/लीटर) या मैंकोजेब (75% WP @ 2.0 ग्राम/लीटर) का छिड़काव करें।",
      expertTitle: "विशेषज्ञ / लैब पुष्टि कब प्राप्त करें?",
      expertText: "यदि 5 दिनों के भीतर तने या फलों पर काले धब्बे फैलते हैं, तो कृषि विशेषज्ञ या नजदीकी KVK से दूसरी राय प्राप्त करें।"
    }
  };

  const current = contentByLang[lang] || contentByLang.mr;

  return (
    <section className="landing-section landing-section-alt">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <GlobeIcon size={14} color="var(--agri-primary)" />
            <span>Actionable Agricultural Decision Support</span>
          </div>
          <h2 className="section-title">From Prediction to Practical Action.</h2>
          <p className="section-desc">
            Diagnostics without actionable, localized guidance leaves farmers stranded. Agri-AI translates computer-vision findings into approved, step-by-step field guidance in the grower's mother tongue.
          </p>
        </div>

        {/* Advisory Preview Card */}
        <div className="advisory-preview-box">
          {/* Top Bar with Language Selector */}
          <div className="advisory-lang-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--agri-dark)" }}>
              <GlobeIcon size={16} color="var(--agri-primary)" />
              <span>Advisory Language / भाषा निवडा:</span>
            </div>

            <div className="lang-switches">
              <button
                type="button"
                className={`lang-btn ${lang === "mr" ? "active" : ""}`}
                onClick={() => setLang("mr")}
                style={{ fontWeight: lang === "mr" ? 800 : 500 }}
              >
                मराठी (Marathi)
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === "hi" ? "active" : ""}`}
                onClick={() => setLang("hi")}
              >
                हिन्दी (Hindi)
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
              >
                English
              </button>
            </div>
          </div>

          {/* Card Body */}
          <div className="advisory-grid">
            {/* Sidebar metadata */}
            <div className="advisory-sidebar">
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--agri-text-subtle)", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                Target Crop &amp; Case
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--agri-dark)", marginBottom: "0.35rem" }}>
                {current.cropLabel}
              </h3>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--agri-primary)", marginBottom: "1rem" }}>
                {current.diseaseLabel}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ background: "var(--agri-accent-subtle)", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "0.78rem", fontWeight: 700, color: "var(--agri-primary)" }}>
                  <CheckCircleIcon size={13} style={{ marginRight: "4px" }} />
                  {current.confidence}
                </div>
                <div style={{ background: "var(--agri-amber-subtle)", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid var(--agri-amber-border)", fontSize: "0.78rem", fontWeight: 700, color: "var(--agri-amber)" }}>
                  <AlertTriangleIcon size={13} style={{ marginRight: "4px" }} />
                  {current.riskText}
                </div>
              </div>

              <div style={{ marginTop: "1.5rem", fontSize: "0.72rem", color: "var(--agri-text-subtle)", borderTop: "1px solid var(--agri-border)", paddingTop: "1rem" }}>
                Standards Source: ICAR / MPKV Rahuri Agricultural University Guidelines &amp; CIB&amp;RC Approved Schedules.
              </div>
            </div>

            {/* Main Action Guidelines */}
            <div className="advisory-main">
              {/* 1. Monitoring */}
              <div className="advisory-step-block">
                <h4>
                  <ShieldIcon size={16} color="var(--agri-primary)" />
                  <span>{current.monitoringTitle}</span>
                </h4>
                <p>{current.monitoringText}</p>
              </div>

              {/* 2. Prevention */}
              <div className="advisory-step-block">
                <h4>
                  <CheckCircleIcon size={16} color="var(--agri-primary)" />
                  <span>{current.preventionTitle}</span>
                </h4>
                <p>{current.preventionText}</p>
              </div>

              {/* 3. Management Guidance */}
              <div className="advisory-step-block">
                <h4>
                  <FlaskIcon size={16} color="var(--agri-amber)" />
                  <span>{current.managementTitle}</span>
                </h4>
                <p>{current.managementText}</p>
              </div>

              {/* 4. Expert Confirmation */}
              <div className="advisory-step-block" style={{ background: "var(--agri-bg-cream)", padding: "0.85rem", borderRadius: "8px", border: "1px solid var(--agri-border)" }}>
                <h4 style={{ color: "var(--agri-dark)" }}>
                  <ExpertIcon size={16} color="var(--agri-primary)" />
                  <span>{current.expertTitle}</span>
                </h4>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>{current.expertText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
