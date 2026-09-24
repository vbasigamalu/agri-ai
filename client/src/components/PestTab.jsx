import { useState, useRef, useEffect } from "react";

const API = "";

function etlColor(ratio) {
  if (ratio >= 2) return "red";
  if (ratio >= 1) return "orange";
  if (ratio >= 0.75) return "yellow";
  return "green";
}

export default function PestTab() {
  const [image, setImage]         = useState(null);
  const [preview, setPreview]     = useState(null);
  const [count, setCount]         = useState(0);
  const [past3d, setPast3d]       = useState(0);
  const [past7d, setPast7d]       = useState(0);
  const [crop, setCrop]           = useState("Tomato");
  const [loading, setLoading]     = useState(false);
  const [status, setStatus]       = useState("");
  const [result, setResult]       = useState(null);
  const [activeIpmTab, setActiveIpmTab] = useState("bio");

  // Camera
  const [showCamera, setShowCamera] = useState(false);

  // Audio voice
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en");

  const fileRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const setImg = (f) => {
    setImage(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setStatus("");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlayingAudio(false);
  };

  async function analyze() {
    if (!image) {
      setStatus("Please select or capture a pest/trap photo first.");
      return;
    }
    setLoading(true);
    setStatus("Detecting pest species and calculating population velocity...");
    setResult(null);

    const fd = new FormData();
    fd.append("image", image);
    fd.append("trapCount", count);
    fd.append("past3DaysCount", past3d);
    fd.append("past7DaysCount", past7d);
    fd.append("crop", crop);

    try {
      const r = await fetch(`${API}/api/pest/detect`, { method: "POST", body: fd });
      const d = await r.json();
      setResult(d);
      setStatus("");
    } catch {
      setStatus("Pest detection failed. Please check if the backend server is running.");
    } finally {
      setLoading(false);
    }
  }

  // Camera logic
  async function openCamera() {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setStatus("Camera access denied or unavailable.");
      setShowCamera(false);
    }
  }

  function snapPhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `pest_${Date.now()}.jpg`, { type: "image/jpeg" });
      setImg(file);
      closeCamera();
    }, "image/jpeg", 0.92);
  }

  function closeCamera() {
    const s = videoRef.current?.srcObject;
    if (s) s.getTracks().forEach((t) => t.stop());
    setShowCamera(false);
  }

  // Audio advisory
  function toggleAudio() {
    if (!result) return;
    if (isPlayingAudio) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported on this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const pestName = result.pest || result.pestName || "Pest species";
    const bioText = (result.biologicalControl || []).slice(0, 2).join(". ");
    const chemText = (result.chemicalControl || []).slice(0, 2).join(". ");

    let txt = "";
    if (voiceLang === "mr") {
      txt = `कीड ओळख: ${pestName}. सापळा मोजणी: ${count}. जैविक नियंत्रण: ${bioText}. रासायनिक नियंत्रण: ${chemText}`;
    } else if (voiceLang === "hi") {
      txt = `पहचानी गई कीट: ${pestName}. ट्रैप संख्या: ${count}. जैविक नियंत्रण: ${bioText}. रासायनिक नियंत्रण: ${chemText}`;
    } else {
      txt = `Identified pest: ${pestName}. Trap count: ${count}. Biological control: ${bioText}. Chemical control: ${chemText}`;
    }

    const u = new SpeechSynthesisUtterance(txt);
    if (voiceLang === "mr") u.lang = "mr-IN";
    else if (voiceLang === "hi") u.lang = "hi-IN";
    else u.lang = "en-US";

    u.onend = () => setIsPlayingAudio(false);
    u.onerror = () => setIsPlayingAudio(false);
    setIsPlayingAudio(true);
    window.speechSynthesis.speak(u);
  }

  const rawPestName = typeof result?.pest === "string" 
    ? result.pest 
    : (typeof result?.pestName === "string" 
      ? result.pestName 
      : (typeof result?.pestId === "string" ? result.pestId : ""));
  const detectedKey = rawPestName.toLowerCase();
  let matchedEtl = 20;
  for (const [k, v] of Object.entries(ETL_MAP)) {
    if (detectedKey.includes(k)) { matchedEtl = v; break; }
  }

  const etl = result ? matchedEtl : null;
  const ratio = etl ? count / etl : 0;
  const alertColor = etlColor(ratio);

  // Growth rate calculation
  const growthDelta = count - past3d;

  return (
    <div>
      <div className="section-header">
        <h2>🦗 Pest &amp; Trap Surveillance Monitor</h2>
        <p>AI pest identification, sticky trap threshold monitoring (ETL), and multi-day population trajectory tracking</p>
      </div>

      <div className="two-col">
        {/* Left Column: Upload & Trap Counters */}
        <div>
          {!preview ? (
            <div className="upload-zone" onClick={() => fileRef.current?.click()}>
              <div className="upload-icon">🦗</div>
              <p><strong>Upload pest or trap photo</strong></p>
              <p className="text-muted mt-1">Clear photo of insect on leaf, or photo of sticky trap card</p>
            </div>
          ) : (
            <div className="upload-preview">
              <img src={preview} alt="Pest" />
              <button
                className="preview-remove"
                onClick={() => { setPreview(null); setImage(null); setResult(null); }}
              >
                ✕
              </button>
            </div>
          )}
          <input
            type="file"
            ref={fileRef}
            accept="image/*"
            hidden
            onChange={(e) => e.target.files[0] && setImg(e.target.files[0])}
          />

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ flex: 1 }}
              onClick={analyze}
              disabled={loading || !image}
            >
              {loading ? <><span className="spinner" /> Analyzing...</> : "🦗 Detect Pest & ETL"}
            </button>
            <button className="btn btn-secondary btn-lg" onClick={openCamera}>
              🤳 Live Camera
            </button>
          </div>

          {status && (
            <div className="status-bar">
              {loading && <span className="spinner" />}
              {status}
            </div>
          )}

          {/* Multi-Day Trap Trajectory Inputs */}
          <div className="card mt-2">
            <div className="card-title">📈 Multi-Day Trap Trajectory Tracker</div>
            <p className="text-muted" style={{ fontSize: "0.76rem", marginBottom: "0.75rem" }}>
              Enter trap counts from previous scouting days to calculate infestation growth velocity
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
              <div>
                <label className="form-label" style={{ fontSize: "0.75rem" }}>🗓️ 7 Days Ago</label>
                <div className="pest-counter-row" style={{ marginTop: 0 }}>
                  <input
                    className="counter-input"
                    type="number"
                    min={0}
                    style={{ width: "100%" }}
                    value={past7d}
                    onChange={(e) => setPast7d(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.75rem" }}>🗓️ 3 Days Ago</label>
                <div className="pest-counter-row" style={{ marginTop: 0 }}>
                  <input
                    className="counter-input"
                    type="number"
                    min={0}
                    style={{ width: "100%" }}
                    value={past3d}
                    onChange={(e) => setPast3d(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.75rem", color: "var(--green-dark)", fontWeight: 700 }}>
                  📍 Today's Count
                </label>
                <div className="pest-counter-row" style={{ marginTop: 0 }}>
                  <input
                    className="counter-input"
                    type="number"
                    min={0}
                    style={{ width: "100%", borderColor: "var(--green)" }}
                    value={count}
                    onChange={(e) => setCount(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>
            </div>

            {past3d > 0 && count > 0 && (
              <div style={{ marginTop: "0.6rem", fontSize: "0.8rem", color: growthDelta > 0 ? "var(--red)" : "var(--green-mid)" }}>
                {growthDelta > 0
                  ? `📈 Population increased by +${growthDelta} insects over the last 3 days`
                  : `📉 Population stabilized or decreased by ${Math.abs(growthDelta)} insects`}
              </div>
            )}
          </div>

          {/* Target Crop Selection */}
          <div className="card mt-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">🌱 Target Crop (Configures ETL Limit)</label>
              <select className="form-input" value={crop} onChange={(e) => setCrop(e.target.value)}>
                {["Tomato", "Cotton", "Wheat", "Rice", "Sugarcane", "Onion", "Chilli", "Potato", "Okra", "Maize"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Column: Identification & IPM Advice */}
        <div>
          {result ? (
            <div>
              <div className="card mb-2">
                <div className="card-title">Identified Pest Species</div>
                <div className="card-value" style={{ color: "var(--text)" }}>
                  {result.pest || result.pestName || "Unknown Insect"}
                </div>
                {result.confidence && (
                  <div className="text-muted mt-1">
                    Vision Confidence: <strong>{Math.round((result.confidence || 0) * 100)}%</strong>
                  </div>
                )}
              </div>

              {/* ETL Alert Status */}
              {etl && (
                <div className={`etl-alert ${alertColor} mb-2`}>
                  <div className="etl-alert-icon">
                    {ratio >= 1 ? "⚠️" : "✅"}
                  </div>
                  <div>
                    <strong>
                      ETL Status: {count} / {etl} insects per trap
                    </strong>
                    <div style={{ marginTop: "0.25rem" }}>
                      {ratio >= 2
                        ? "🚨 Population is far above economic threshold! Immediate chemical or biological intervention recommended."
                        : ratio >= 1
                        ? "⚠️ Trap count reached scientific threshold limit. Apply targeted spray within 24–48 hours."
                        : ratio >= 0.75
                        ? "🟡 Approaching economic threshold. Increase trap scouting frequency."
                        : "✅ Population is below damage threshold. No chemical spray required at this stage."}
                    </div>
                  </div>
                </div>
              )}

              {/* Voice Readout Player Card */}
              <div className="voice-readout-card mb-2">
                <div className="voice-title-group">
                  <span className="voice-icon">🔊</span>
                  <div>
                    <strong>Pest Advisory Audio</strong>
                    <p>Listen to control steps out loud</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <select
                    className="form-input"
                    style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                    value={voiceLang}
                    onChange={(e) => setVoiceLang(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="hi">हिंदी</option>
                    <option value="mr">मराठी</option>
                  </select>
                  <button
                    className={`btn ${isPlayingAudio ? "btn-danger" : "btn-primary"}`}
                    onClick={toggleAudio}
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.82rem" }}
                  >
                    {isPlayingAudio ? "⏹️ Stop" : "▶️ Play"}
                  </button>
                </div>
              </div>

              {/* IPM Control Tabs */}
              <div className="card">
                <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem", borderBottom: "1px solid var(--border-soft)", paddingBottom: "0.5rem" }}>
                  <button
                    className={`btn ${activeIpmTab === "bio" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}
                    onClick={() => setActiveIpmTab("bio")}
                  >
                    🌿 Biological
                  </button>
                  <button
                    className={`btn ${activeIpmTab === "chem" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}
                    onClick={() => setActiveIpmTab("chem")}
                  >
                    🧪 Chemical
                  </button>
                  <button
                    className={`btn ${activeIpmTab === "prev" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}
                    onClick={() => setActiveIpmTab("prev")}
                  >
                    🛡️ Cultural
                  </button>
                </div>

                {activeIpmTab === "bio" && (
                  <div>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--green-dark)" }}>
                      🌿 Organic &amp; Biological Control
                    </h4>
                    <ul className="advice-list">
                      {(result.biologicalControl && result.biologicalControl.length > 0
                        ? result.biologicalControl
                        : ["Install species-specific pheromone or sticky cards.", "Conserve predatory beneficial insects (Ladybirds, Chrysoperla).", "Spray neem seed kernel extract (NSKE 5%) or Azadirachtin."]
                      ).map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeIpmTab === "chem" && (
                  <div>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--orange)" }}>
                      🧪 CIB&amp;RC Approved Insecticide Interventions
                    </h4>
                    <ul className="advice-list orange">
                      {(result.chemicalControl && result.chemicalControl.length > 0
                        ? result.chemicalControl
                        : ["Apply recommended systemic insecticide if trap count exceeds ETL.", "Spray early morning or late afternoon to avoid honeybee activity."]
                      ).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeIpmTab === "prev" && (
                  <div>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--blue)" }}>
                      🛡️ Cultural &amp; Preventive Measures
                    </h4>
                    <ul className="advice-list blue">
                      {((result.prevention && result.prevention.length > 0 ? result.prevention : (result.preventiveMeasures && result.preventiveMeasures.length > 0 ? result.preventiveMeasures : null)) ||
                        ["Maintain field sanitation and remove weed hosts on borders.", "Adopt crop rotation with non-host crops.", "Deep summer ploughing to expose pupae to solar heat."]
                      ).map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
              <div style={{ fontSize: "2.8rem", marginBottom: "0.5rem" }}>🦗</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>Ready for Pest Inspection</h3>
              <p className="text-muted mt-1" style={{ maxWidth: "380px", margin: "0.4rem auto 0" }}>
                Upload an insect or sticky trap photo to determine pest classification, trap density, and Economic Threshold Limits.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Live Camera Modal */}
      {showCamera && (
        <div className="modal-overlay" onClick={closeCamera}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <video ref={videoRef} className="modal-video" autoPlay playsInline />
            <div className="modal-controls">
              <button className="btn btn-primary btn-lg" onClick={snapPhoto}>
                📸 Capture Pest Photo
              </button>
              <button className="btn btn-danger" onClick={closeCamera}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
