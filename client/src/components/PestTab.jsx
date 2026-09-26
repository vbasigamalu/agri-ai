import { useState, useRef, useEffect } from "react";
import { resolveInitialLocation, saveActiveScanLocation, MAHARASHTRA_DISTRICTS } from "../utils/geoUtils";
import {
  PestIcon,
  LocationPinIcon,
  MapIcon,
  ExpertIcon,
  CameraIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  LeafIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  VolumeIcon,
  FlaskIcon,
  ShieldIcon,
  CloseIcon,
  RefreshIcon,
  SatelliteIcon,
  MicroscopeIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from "./Icons";

const API = "";

const ETL_MAP = {
  thrip: 20,
  whitefly: 15,
  aphid: 25,
  borer: 5,
  helicoverpa: 5,
  fall_armyworm: 8,
  armyworm: 8,
  mite: 30,
  caterpillar: 10,
  jassid: 15,
  default: 20
};

function etlColor(ratio) {
  if (ratio >= 2) return "red";
  if (ratio >= 1) return "orange";
  if (ratio >= 0.75) return "yellow";
  return "green";
}

export default function PestTab({ user, onScanCompleted, onNavigateToMap, onNavigateToExpert }) {
  const initialGeo = resolveInitialLocation(user);
  const [latLon, setLatLon] = useState({ lat: initialGeo.lat, lon: initialGeo.lon });
  const [locationName, setLocationName] = useState(initialGeo.locationName);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

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

  // Expert Validation Escalation State
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalatedCaseRef, setEscalatedCaseRef] = useState(null);

  async function escalatePestToExpert() {
    if (!result || isEscalating) return;
    setIsEscalating(true);
    try {
      const res = await fetch(`${API}/api/expert/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "pest",
          crop: crop || "Tomato",
          aiDisease: `${result.pest?.name || "Insect Pest"} (${result.pest?.scientificName || ""})`,
          aiConfidence: Math.round((result.pest?.confidence || 0.7) * 100),
          aiSeverity: `${result.infestation?.severity || "Moderate"} (Trap: ${count})`,
          aiStatus: (result.pest?.confidence || 1) < 0.75 ? "uncertain" : "confirmed",
          symptoms: result.recommendations?.symptoms || [`Pest scouting report for ${crop}`],
          vlmEvidence: {
            pestId: result.pest?.id,
            trapCount: count,
            etlStatus: result.infestation?.severity
          },
          imageUrl: result.imageUrl || preview || null,
          imageName: image ? image.name : "pest_trap.jpg",
          farmerName: user?.name || "Farmer",
          district: user?.district || locationName.split(",")[0] || "Sangli",
          village: user?.village || "Farm Field",
          latitude: latLon.lat,
          longitude: latLon.lon
        })
      });
      const data = await res.json();
      if (data.success && data.case) {
        setEscalatedCaseRef(data.case.case_number);
      }
    } catch (e) {
      console.warn("Could not escalate pest to expert:", e);
    } finally {
      setIsEscalating(false);
    }
  }

  function detectGps() {
    if ("geolocation" in navigator) {
      setIsDetectingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setLatLon({ lat, lon });
          setLocationName(`Field GPS [${lat.toFixed(4)}, ${lon.toFixed(4)}]`);
          setIsDetectingGps(false);
        },
        () => {
          setIsDetectingGps(false);
        },
        { timeout: 8000 }
      );
    }
  }

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
    fd.append("lat", latLon.lat);
    fd.append("lon", latLon.lon);
    fd.append("locationName", locationName);
    if (user?.name) fd.append("farmerName", user.name);

    try {
      const r = await fetch(`${API}/api/pest/detect`, { method: "POST", body: fd });
      const d = await r.json();
      setResult(d);
      setStatus("");

      // Save active scan location for GIS Outbreak Map
      const activeScanLoc = saveActiveScanLocation({
        lat: latLon.lat,
        lon: latLon.lon,
        locationName: locationName || "Pest Trap Location",
        crop: crop || "Crop",
        condition: d.pest?.name || "Pest Infestation",
        category: "pest",
        severity: d.infestation?.severity || "Moderate",
        confidence: d.pest?.confidence || 0.88,
        timestamp: new Date().toISOString()
      });
      if (typeof onScanCompleted === "function" && activeScanLoc) {
        onScanCompleted(activeScanLoc);
      }
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
    const pestName = result.pest?.name || (typeof result.pest === "string" ? result.pest : null) || result.pestName || "Pest species";
    const bioText = (result.biologicalControl || result.recommendations?.biologicalControl || []).slice(0, 2).join(". ");
    const chemText = (result.chemicalControl || result.recommendations?.chemicalControl || []).slice(0, 2).join(". ");

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

  const rawPestName = result?.pest?.id || result?.pest?.name || (typeof result?.pest === "string" 
    ? result.pest 
    : (typeof result?.pestName === "string" 
      ? result.pestName 
      : (typeof result?.pestId === "string" ? result.pestId : "")));
  const detectedKey = rawPestName.toLowerCase();
  let matchedEtl = result?.infestation?.threshold || 20;
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
        <h2><PestIcon size={22} style={{ marginRight: 8, verticalAlign: "middle" }} /> Pest &amp; Trap Surveillance Monitor</h2>
        <p>AI pest identification, sticky trap threshold monitoring (ETL), and multi-day population trajectory tracking</p>
      </div>

      {/* Trap Field Location Bar */}
      <div className="location-chip-row" style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "0.6rem" }}>
        <div className="location-info">
          <LocationPinIcon size={14} color="#059669" />
          <span>Trap Location:</span>
          <strong>{locationName}</strong>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            [{latLon.lat.toFixed(4)}, {latLon.lon.toFixed(4)}]
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <button
            type="button"
            className="mini-btn"
            onClick={detectGps}
            disabled={isDetectingGps}
            style={{ display: "flex", alignItems: "center", gap: "5px" }}
          >
            <SatelliteIcon size={13} />
            {isDetectingGps ? "Detecting..." : "GPS Auto-Detect"}
          </button>
          <button
            type="button"
            className="mini-btn"
            onClick={() => setShowLocationPicker((prev) => !prev)}
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <MapIcon size={13} /> Change Region {showLocationPicker ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
          </button>
        </div>
      </div>

      {/* Quick Regional District Selector */}
      {showLocationPicker && (
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "0.6rem 0.85rem",
          marginBottom: "1rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.4rem"
        }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginRight: "4px" }}>
            Select District:
          </span>
          {Object.entries(MAHARASHTRA_DISTRICTS).map(([key, d]) => (
            <button
              key={key}
              type="button"
              className="mini-btn"
              style={{
                background: locationName.toLowerCase().includes(key) ? "rgba(37,99,235,0.12)" : "#ffffff",
                borderColor: locationName.toLowerCase().includes(key) ? "#2563eb" : "#cbd5e1",
                color: locationName.toLowerCase().includes(key) ? "#1d4ed8" : "#334155",
                fontWeight: locationName.toLowerCase().includes(key) ? 700 : 500
              }}
              onClick={() => {
                setLatLon({ lat: d.lat, lon: d.lon });
                setLocationName(d.name);
                setShowLocationPicker(false);
              }}
            >
              {d.name.split(",")[0]}
            </button>
          ))}
        </div>
      )}

      <div className="two-col">
        {/* Left Column: Upload & Trap Counters */}
        <div>
          {!preview ? (
            <div className="upload-zone" onClick={() => fileRef.current?.click()}>
              <div className="upload-icon">
                <PestIcon size={38} color="#059669" />
              </div>
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
                <CloseIcon size={16} />
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
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              onClick={analyze}
              disabled={loading || !image}
            >
              {loading ? <><span className="spinner" /> Analyzing...</> : <><PestIcon size={16} /> Detect Pest &amp; ETL</>}
            </button>
            <button className="btn btn-secondary btn-lg" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }} onClick={openCamera}>
              <CameraIcon size={16} /> Live Camera
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
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUpIcon size={16} color="var(--primary)" /> Multi-Day Trap Trajectory Tracker
            </div>
            <p className="text-muted" style={{ fontSize: "0.76rem", marginBottom: "0.75rem" }}>
              Enter trap counts from previous scouting days to calculate infestation growth velocity
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
              <div>
                <label className="form-label" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}>
                  <CalendarIcon size={13} /> 7 Days Ago
                </label>
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
                <label className="form-label" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}>
                  <CalendarIcon size={13} /> 3 Days Ago
                </label>
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
                <label className="form-label" style={{ fontSize: "0.75rem", color: "var(--green-dark)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                  <LocationPinIcon size={13} color="var(--green-dark)" /> Today's Count
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
                {growthDelta > 0 ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <TrendingUpIcon size={14} color="var(--red)" /> Population increased by +{growthDelta} insects over the last 3 days
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <TrendingDownIcon size={14} color="var(--green-mid)" /> Population stabilized or decreased by {Math.abs(growthDelta)} insects
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Target Crop Selection */}
          <div className="card mt-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <LeafIcon size={15} color="var(--primary)" /> Target Crop (Configures ETL Limit)
              </label>
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
                  {result.pest?.name || (typeof result.pest === "string" ? result.pest : null) || result.pestName || "Unknown Insect"}
                  {result.pest?.scientificName && (
                    <span style={{ fontSize: "0.85rem", fontStyle: "italic", color: "var(--text-secondary)", marginLeft: "8px" }}>
                      ({result.pest.scientificName})
                    </span>
                  )}
                </div>
                {(result.pest?.confidence || result.confidence) && (
                  <div className="text-muted mt-1">
                    Vision Confidence: <strong>{Math.round(((result.pest?.confidence || result.confidence || 0) <= 1 ? (result.pest?.confidence || result.confidence || 0) * 100 : (result.pest?.confidence || result.confidence || 0)))}%</strong>
                  </div>
                )}
              </div>

              {/* Expert Validation & HITL Alert for Pests */}
              {((result.pest?.confidence && result.pest.confidence < 0.75) || result.infestation?.isEtlExceeded || escalatedCaseRef || result.expertValidation?.enqueued) && (
                <div style={{
                  background: "linear-gradient(90deg, #fff7ed 0%, #ffedd5 100%)",
                  border: "1.5px solid #f97316",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                  marginBottom: "0.85rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.6rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ExpertIcon size={20} color="#9a3412" />
                    <div>
                      <div style={{ fontWeight: 800, color: "#9a3412", fontSize: "0.88rem" }}>
                        {escalatedCaseRef || result.expertValidation?.caseNumber
                          ? `Enqueued for Agronomist Review (${escalatedCaseRef || result.expertValidation?.caseNumber})`
                          : "Borderline Pest Identification — Escalated to Agronomist"}
                      </div>
                      <div style={{ color: "#7c2d12", fontSize: "0.78rem" }}>
                        Active Learning: Ground-truth verification active to confirm species morphology and ETL threshold.
                      </div>
                    </div>
                  </div>
                  {onNavigateToExpert && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onNavigateToExpert}
                      style={{
                        padding: "0.38rem 0.85rem",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        background: "#ea580c",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                    >
                      <ExpertIcon size={14} color="#ffffff" /> View in Expert Queue &rarr;
                    </button>
                  )}
                </div>
              )}

              {/* PostGIS Pest Outbreak Sync Card */}
              <div style={{
                background: "linear-gradient(90deg, #faf5ff 0%, #f5f3ff 100%)",
                border: "1.5px solid #c4b5fd",
                borderRadius: "10px",
                padding: "0.75rem 1rem",
                marginBottom: "0.85rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.6rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <PestIcon size={20} color="#6d28d9" />
                  <div>
                    <div style={{ fontWeight: 800, color: "#6d28d9", fontSize: "0.88rem" }}>
                      Recorded in PostGIS Pest Surveillance
                    </div>
                    <div style={{ color: "#475569", fontSize: "0.8rem" }}>
                      Trap coordinates: <strong>[{latLon.lat.toFixed(4)}, {latLon.lon.toFixed(4)}]</strong> · {locationName}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  {onNavigateToMap && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={onNavigateToMap}
                      style={{ padding: "0.4rem 0.85rem", fontSize: "0.82rem", fontWeight: 700, background: "#7c3aed", borderColor: "#7c3aed", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      <MapIcon size={14} color="#ffffff" /> View on GIS Outbreak Map &rarr;
                    </button>
                  )}
                  {onNavigateToExpert && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onNavigateToExpert}
                      style={{
                        padding: "0.4rem 0.85rem",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#7e22ce",
                        background: "rgba(147,51,234,0.08)",
                        border: "1.5px solid #a855f7",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                    >
                      <ExpertIcon size={14} color="#7e22ce" /> Agronomist Queue &rarr;
                    </button>
                  )}
                  {!escalatedCaseRef && !result.expertValidation?.enqueued && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={escalatePestToExpert}
                      disabled={isEscalating}
                      style={{
                        padding: "0.4rem 0.85rem",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#0369a1",
                        background: "rgba(2,132,199,0.08)",
                        border: "1.5px solid #38bdf8",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                    >
                      <MicroscopeIcon size={14} />
                      {isEscalating ? "Escalating..." : "Request Agronomist Second Opinion"}
                    </button>
                  )}
                </div>
              </div>

              {/* ETL Alert Status */}
              {etl && (
                <div className={`etl-alert ${alertColor} mb-2`}>
                  <div className="etl-alert-icon">
                    {ratio >= 1 ? <AlertTriangleIcon size={22} color="#ea580c" /> : <CheckCircleIcon size={22} color="#059669" />}
                  </div>
                  <div>
                    <strong>
                      ETL Status: {count} / {etl} insects per trap
                    </strong>
                    <div style={{ marginTop: "0.25rem" }}>
                      {ratio >= 2
                        ? "Population is far above economic threshold! Immediate chemical or biological intervention recommended."
                        : ratio >= 1
                        ? "Trap count reached scientific threshold limit. Apply targeted spray within 24–48 hours."
                        : ratio >= 0.75
                        ? "Approaching economic threshold. Increase trap scouting frequency."
                        : "Population is below damage threshold. No chemical spray required at this stage."}
                    </div>
                  </div>
                </div>
              )}

              {/* Voice Readout Player Card */}
              <div className="voice-readout-card mb-2">
                <div className="voice-title-group">
                  <span className="voice-icon" style={{ display: "inline-flex", alignItems: "center" }}>
                    <VolumeIcon size={18} color="var(--primary)" />
                  </span>
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
                    {isPlayingAudio ? "Stop" : "Play"}
                  </button>
                </div>
              </div>

              {/* IPM Control Tabs */}
              <div className="card">
                <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem", borderBottom: "1px solid var(--border-soft)", paddingBottom: "0.5rem" }}>
                  <button
                    className={`btn ${activeIpmTab === "bio" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={() => setActiveIpmTab("bio")}
                  >
                    <LeafIcon size={14} /> Biological
                  </button>
                  <button
                    className={`btn ${activeIpmTab === "chem" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={() => setActiveIpmTab("chem")}
                  >
                    <FlaskIcon size={14} /> Chemical
                  </button>
                  <button
                    className={`btn ${activeIpmTab === "prev" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={() => setActiveIpmTab("prev")}
                  >
                    <ShieldIcon size={14} /> Cultural
                  </button>
                </div>

                {activeIpmTab === "bio" && (
                  <div>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--green-dark)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <LeafIcon size={16} color="var(--green-dark)" /> Organic &amp; Biological Control
                    </h4>
                    <ul className="advice-list">
                      {((result.biologicalControl && result.biologicalControl.length > 0)
                        ? result.biologicalControl
                        : (result.recommendations?.biologicalControl && result.recommendations.biologicalControl.length > 0)
                        ? result.recommendations.biologicalControl
                        : ["Install species-specific pheromone or sticky cards.", "Conserve predatory beneficial insects (Ladybirds, Chrysoperla).", "Spray neem seed kernel extract (NSKE 5%) or Azadirachtin."]
                      ).map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeIpmTab === "chem" && (
                  <div>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--orange)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <FlaskIcon size={16} color="var(--orange)" /> CIB&amp;RC Approved Insecticide Interventions
                    </h4>
                    <ul className="advice-list orange">
                      {((result.chemicalControl && result.chemicalControl.length > 0)
                        ? result.chemicalControl
                        : (result.recommendations?.chemicalControl && result.recommendations.chemicalControl.length > 0)
                        ? result.recommendations.chemicalControl
                        : ["Apply recommended systemic insecticide if trap count exceeds ETL.", "Spray early morning or late afternoon to avoid honeybee activity."]
                      ).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeIpmTab === "prev" && (
                  <div>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.4rem", color: "var(--blue)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <ShieldIcon size={16} color="var(--blue)" /> Cultural &amp; Preventive Measures
                    </h4>
                    <ul className="advice-list blue">
                      {((result.prevention && result.prevention.length > 0 ? result.prevention : (result.preventiveMeasures && result.preventiveMeasures.length > 0 ? result.preventiveMeasures : (result.recommendations?.prevention && result.recommendations.prevention.length > 0 ? result.recommendations.prevention : null))) ||
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
              <div style={{ marginBottom: "0.5rem", color: "var(--primary)", display: "flex", justifyContent: "center" }}>
                <PestIcon size={48} />
              </div>
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
              <button className="btn btn-primary btn-lg" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }} onClick={snapPhoto}>
                <CameraIcon size={16} /> Capture Pest Photo
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
