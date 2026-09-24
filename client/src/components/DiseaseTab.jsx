import { useState, useRef, useEffect } from "react";
import EXIF from "exif-js";

const API = "";

function getSeverityBadgeClass(sev) {
  const s = (sev || "").toLowerCase();
  if (s.includes("critical")) return "severity-critical";
  if (s.includes("severe") || s.includes("major")) return "severity-severe";
  if (s.includes("moderate")) return "severity-moderate";
  if (s.includes("mild")) return "severity-mild";
  return "severity-healthy";
}

function getConfidenceScore(res) {
  if (!res) return 0;
  if (res.confidencePercent !== undefined && res.confidencePercent !== null) {
    return Math.round(res.confidencePercent);
  }
  if (typeof res.confidence === "number") {
    return res.confidence <= 1 ? Math.round(res.confidence * 100) : Math.round(res.confidence);
  }
  return 0;
}

// Convert EXIF degrees/minutes/seconds to decimal degrees
function convertDMSToDecimal(dms, ref) {
  if (!dms || dms.length < 3) return null;
  let degrees = dms[0].numerator ? dms[0].numerator / dms[0].denominator : Number(dms[0]);
  let minutes = dms[1].numerator ? dms[1].numerator / dms[1].denominator : Number(dms[1]);
  let seconds = dms[2].numerator ? dms[2].numerator / dms[2].denominator : Number(dms[2]);

  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (ref === "S" || ref === "W") decimal *= -1;
  return decimal;
}

// Read EXIF GPS from File object
function extractExifGps(file) {
  return new Promise((resolve) => {
    try {
      const ExifLib = window.EXIF || EXIF;
      if (!ExifLib || !ExifLib.getData) {
        resolve(null);
        return;
      }
      ExifLib.getData(file, function () {
        try {
          const latDms = ExifLib.getTag(this, "GPSLatitude");
          const latRef = ExifLib.getTag(this, "GPSLatitudeRef");
          const lonDms = ExifLib.getTag(this, "GPSLongitude");
          const lonRef = ExifLib.getTag(this, "GPSLongitudeRef");

          if (latDms && lonDms) {
            const lat = convertDMSToDecimal(latDms, latRef);
            const lon = convertDMSToDecimal(lonDms, lonRef);
            if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
              resolve({ lat, lon });
              return;
            }
          }
          resolve(null);
        } catch (e) {
          console.warn("EXIF GPS parsing error:", e);
          resolve(null);
        }
      });
    } catch (e) {
      console.warn("EXIF extraction failed:", e);
      resolve(null);
    }
  });
}

export default function DiseaseTab({ user }) {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  
  // Location State
  const [locationName, setLocationName] = useState(user?.district ? `${user.district}, Maharashtra` : "Delhi (Default)");
  const [latLon, setLatLon] = useState({ lat: 28.6139, lon: 77.2090 });
  const [locSource, setLocSource] = useState("Default"); // "Image GPS" | "Manual - Verified" | "Device GPS" | "Default"

  // Location Prompt & Validation Modal
  const [showLocModal, setShowLocModal] = useState(false);
  const [locInput, setLocInput] = useState(user?.district || "Nashik");
  const [isValidatingLoc, setIsValidatingLoc] = useState(false);
  const [locError, setLocError] = useState("");
  const [locSuccess, setLocSuccess] = useState("");

  // Live Camera
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [dragover, setDragover] = useState(false);

  // Audio TTS Readout
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en");

  // Chatbot
  const [chatMsgs, setChatMsgs] = useState([
    { role: "bot", text: "Hello! I am your AI Agricultural Advisor. Upload a crop leaf photo to get real-time disease detection, spray schedule, and dosage." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const chatEndRef = useRef(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Main Image Selection Handler with EXIF Metadata Extraction
  const handleFileSelect = async (file) => {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setStatus("🔍 Checking image metadata for GPS location...");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlayingAudio(false);

    // 1. Try Image EXIF Metadata
    const gps = await extractExifGps(file);

    if (gps) {
      console.log(`📍 Found GPS in Image: Lat ${gps.lat.toFixed(4)}, Lon ${gps.lon.toFixed(4)}`);
      setLatLon({ lat: gps.lat, lon: gps.lon });
      const tempLoc = `📍 [${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}] (From Image GPS)`;
      setLocationName(tempLoc);
      setLocSource("Image GPS");
      setStatus(`📍 Found GPS in Image metadata! (${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)})`);

      // Resolve human-readable address in background
      try {
        const r = await fetch(`${API}/api/geocode?lat=${gps.lat}&lon=${gps.lon}`);
        const d = await r.json();
        if (d.address) {
          setLocationName(`${d.address} (From Image GPS)`);
        }
      } catch (err) {
        console.warn("Background reverse geocode failed:", err);
      }
    } else {
      // 2. No EXIF GPS found -> Ask the farmer
      console.log("⚠️ This image does NOT have GPS location data. Prompting farmer...");
      setStatus("⚠️ No GPS metadata in image. Please confirm your farm location.");
      setLocError("");
      setLocSuccess("");
      setLocInput(user?.district || "Nashik");
      setShowLocModal(true);
    }
  };

  // Validate Location with OpenStreetMap Nominatim
  async function validateLocation(cityToValidate) {
    const query = (cityToValidate || locInput).trim();
    if (!query) {
      setLocError("Please enter a City, Village, or District name.");
      return;
    }

    setIsValidatingLoc(true);
    setLocError("");
    setLocSuccess("");

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { "User-Agent": "AgriAI/1.0" } }
      );
      const geoData = await geoRes.json();

      if (geoData && geoData.length > 0) {
        const place = geoData[0];
        const validatedCity = place.display_name.split(",")[0].trim();
        const stateInfo = place.display_name.split(",").slice(1, 3).join(",").trim();
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);

        console.log(`✅ Validated Location: ${validatedCity} (${lat}, ${lon})`);
        setLatLon({ lat, lon });
        const finalDisplayName = `${validatedCity}${stateInfo ? ", " + stateInfo : ""} (Manual - Verified)`;
        setLocationName(finalDisplayName);
        setLocSource("Manual - Verified");
        setLocSuccess(`✅ Validated: ${validatedCity} (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
        setStatus(`📍 Location set: ${validatedCity} (Verified)`);

        setTimeout(() => {
          setShowLocModal(false);
          setLocSuccess("");
        }, 1200);
      } else {
        // Location not found
        setLocError(`❌ Unable to find '${query}'. Please check the spelling or enter a nearby city/district.`);
      }
    } catch (err) {
      console.warn("Location validation network error:", err);
      // Fallback: accept as manual unverified
      setLocationName(`${query} (Manual - Unverified)`);
      setLocSource("Manual - Unverified");
      setShowLocModal(false);
    } finally {
      setIsValidatingLoc(false);
    }
  }

  // Fallback to Delhi
  function useDefaultDelhi() {
    setLatLon({ lat: 28.6139, lon: 77.2090 });
    setLocationName("Delhi (Fallback)");
    setLocSource("Default");
    setStatus("📍 Location set to Delhi (Fallback)");
    setShowLocModal(false);
  }

  // Fallback to Device GPS
  function useDeviceGps() {
    if ("geolocation" in navigator) {
      setIsValidatingLoc(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setLatLon({ lat, lon });
          setLocationName(`📍 [${lat.toFixed(4)}, ${lon.toFixed(4)}] (From Device GPS)`);
          setLocSource("Device GPS");
          setIsValidatingLoc(false);
          setShowLocModal(false);
          setStatus(`📍 Set to Device GPS (${lat.toFixed(2)}, ${lon.toFixed(2)})`);

          try {
            const r = await fetch(`${API}/api/geocode?lat=${lat}&lon=${lon}`);
            const d = await r.json();
            if (d.address) setLocationName(`${d.address} (From Device GPS)`);
          } catch (e) {
            console.warn("Geocode error:", e);
          }
        },
        (err) => {
          setIsValidatingLoc(false);
          setLocError(`Device GPS error: ${err.message}. Please enter city name manually.`);
        },
        { timeout: 7000 }
      );
    } else {
      setLocError("Device geolocation is not supported in this browser.");
    }
  }

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect(file);
    }
  };

  // Run AI Crop Analysis
  async function analyzeCrop() {
    if (!image) {
      setStatus("Please select or capture a crop photo first.");
      return;
    }

    setLoading(true);
    setStatus("Analyzing leaf image with AI Vision Engine...");
    setResult(null);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlayingAudio(false);

    const formData = new FormData();
    formData.append("image", image);
    formData.append("lat", latLon.lat);
    formData.append("lon", latLon.lon);
    formData.append("locationName", locationName);
    if (user?.name) formData.append("farmerName", user.name);

    const headers = {};
    if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers,
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResult(data);
      setStatus("");

      // Save to localStorage history so it's always accessible in HistoryTab
      try {
        const historyKey = "agri_local_history";
        const existing = JSON.parse(localStorage.getItem(historyKey) || "[]");
        const newRecord = {
          _id: "local_" + Date.now(),
          timestamp: new Date().toISOString(),
          crop: data.crop || "Crop",
          diseaseName: data.disease || "Unknown",
          confidence: getConfidenceScore(data),
          severity: data.severity || "Moderate",
          causedBy: data.causedBy || "Crop Pathogen",
          temperature: data.temperature || 25,
          humidity: data.humidity || 60,
          wind: data.wind || 5,
          alert: data.alert || "",
          spray: data.spray || "N/A",
          spray_action_time: data.spray_action_time || "N/A",
          spray_quantity: data.spray_quantity || "N/A",
          sprayWarnings: data.sprayWarnings || [],
          symptoms: data.symptoms || [],
          advice: data.advice || [],
          prevention: data.prevention || [],
          locationName: locationName
        };
        localStorage.setItem(historyKey, JSON.stringify([newRecord, ...existing.slice(0, 39)]));
      } catch (e) {
        console.warn("Could not save to local history:", e);
      }

      // Add bot notification message
      const confScore = getConfidenceScore(data);
      let welcomeTxt = `Analysis complete! Detected: ${data.disease} (${confScore}% confidence). Severity: ${data.severity || "Normal"}.`;
      if (data.spray && data.spray !== "N/A" && data.spray !== "No treatment needed") {
        welcomeTxt += ` Recommended spray: ${data.spray} (${data.spray_quantity || ""}).`;
      }
      setChatMsgs((prev) => [
        ...prev,
        { role: "bot", text: welcomeTxt }
      ]);

    } catch (err) {
      console.error("Analysis Error:", err);
      setStatus("❌ " + (err.message || "Failed to analyze image. Is backend running?"));
    } finally {
      setLoading(false);
    }
  }

  // Camera handling
  async function openCamera() {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setStatus("Camera access was denied or not supported.");
      setShowCamera(false);
    }
  }

  function flipCamera() {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    closeCamera();
    setTimeout(() => {
      setShowCamera(true);
      navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing } })
        .then((stream) => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(() => setShowCamera(false));
    }, 200);
  }

  function snapPhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });
      handleFileSelect(file);
      closeCamera();
    }, "image/jpeg", 0.92);
  }

  function closeCamera() {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setShowCamera(false);
  }

  // Audio Voice Readout (TTS)
  function toggleAudioAdvisory() {
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
    
    const disease = result.disease || "crop condition";
    const severity = result.severity || "moderate";
    const spray = result.spray || "no chemical spray required";
    const timing = result.spray_action_time || "early morning";
    const quantity = result.spray_quantity || "standard dilution";
    const treatment = (result.advice && result.advice.length > 0) ? result.advice.slice(0, 2).join(". ") : "";

    let speechText = "";
    if (voiceLang === "mr") {
      speechText = `पिकावरील रोग: ${disease}. तीव्रता: ${severity}. फवारणी शिफारस: ${spray}. फवारणी वेळ: ${timing}. प्रमाण: ${quantity}. उपचार: ${treatment}`;
    } else if (voiceLang === "hi") {
      speechText = `फसल में रोग: ${disease}. गंभीरता: ${severity}. छिड़काव सलाह: ${spray}. समय: ${timing}. मात्रा: ${quantity}. उपचार: ${treatment}`;
    } else {
      speechText = `Diagnosis: ${disease}. Severity level: ${severity}. Spray recommendation: ${spray}. Recommended timing: ${timing}. Dosage: ${quantity}. Key treatment: ${treatment}`;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 0.95;
    
    if (voiceLang === "mr") utterance.lang = "mr-IN";
    else if (voiceLang === "hi") utterance.lang = "hi-IN";
    else utterance.lang = "en-US";

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  }

  // AI Chat
  async function sendChatMessage() {
    const q = chatInput.trim();
    if (!q) return;

    setChatMsgs((prev) => [...prev, { role: "user", text: q }]);
    setChatInput("");
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

    let scanContext = "";
    if (result) {
      scanContext = `Disease: ${result.disease}, Severity: ${result.severity}, Caused by: ${result.causedBy}, Spray: ${result.spray} (Timing: ${result.spray_action_time}, Qty: ${result.spray_quantity}), Weather: ${result.temperature}°C, ${result.humidity}% humidity.`;
    }

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          message: q,
          context: scanContext,
          language: voiceLang === "mr" ? "Marathi" : voiceLang === "hi" ? "Hindi" : "English"
        })
      });

      const data = await res.json();
      const reply = data.answer || data.reply || "I am here to guide you with any questions regarding crop health.";
      setChatMsgs((prev) => [...prev, { role: "bot", text: reply }]);
    } catch {
      setChatMsgs((prev) => [...prev, { role: "bot", text: "Unable to reach the AI advisor brain. Please check your backend connection." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    }
  }

  const confScore = getConfidenceScore(result);
  const severityBadgeClass = getSeverityBadgeClass(result?.severity);

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <h2>🌿 Crop Disease Detection &amp; Treatment Advisor</h2>
        <p>AI-driven diagnosis with instant spray recommendations, severity grading, and weather-aware advice</p>
      </div>

      {/* Detection Location Row */}
      <div className="location-chip-row">
        <div className="location-info">
          <span>📍</span>
          <span>Field Location:</span>
          <strong>{locationName}</strong>
        </div>
        <div>
          <button
            className="mini-btn"
            onClick={() => {
              setLocInput(user?.district || "Nashik");
              setLocError("");
              setLocSuccess("");
              setShowLocModal(true);
            }}
          >
            Change
          </button>
        </div>
      </div>

      <div className="two-col">
        {/* LEFT COLUMN: Upload & Results */}
        <div>
          {/* Upload Area */}
          {!preview ? (
            <div
              className={`upload-zone${dragover ? " dragover" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={handleDrop}
            >
              <div className="upload-icon">📸</div>
              <p><strong>Click to upload</strong> or drag &amp; drop leaf photo</p>
              <p className="text-muted mt-1">Supports JPG, PNG, WebP — GPS metadata auto-detected from photo</p>
            </div>
          ) : (
            <div className="upload-preview">
              <img src={preview} alt="Crop preview" />
              <button
                className="preview-remove"
                onClick={() => { setPreview(null); setImage(null); setResult(null); }}
                title="Remove photo"
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
            onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
          />

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ flex: 1 }}
              onClick={analyzeCrop}
              disabled={loading || !image}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Analyzing Leaf...
                </>
              ) : (
                "🔬 Analyze Crop Conditions"
              )}
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

          {/* DETAILED ANALYSIS RESULTS */}
          {result && (
            <div className="mt-2">
              {/* Uncertainty / Quality Alert if flagged */}
              {result.uncertainty?.flagged && (
                <div className="quality-warning-card">
                  <strong>⚠️ Model Uncertainty Warning</strong>
                  <span>
                    The AI detected potential uncertainty in this image ({result.uncertainty.reason || "unconfirmed_prediction"}).
                    Please ensure the photo is clear, well-lit, and shows only the diseased plant leaf.
                  </span>
                </div>
              )}

              {result.imageQuality && result.imageQuality.valid === false && (
                <div className="quality-warning-card">
                  <strong>⚠️ Image Quality Alert (Score: {result.imageQuality.score}%)</strong>
                  <span>{result.imageQuality.recommendation || "Please retake the photo with better lighting and sharp focus."}</span>
                </div>
              )}

              {/* Grid of Core Results */}
              <div className="result-grid-disease">
                {/* 1. Disease Name & Pathogen */}
                <div className="hero-disease-card full">
                  <div className="disease-header-row">
                    <div>
                      <div className="card-title">Predicted Disease</div>
                      <div className="disease-name">{result.disease || "No Disease Detected"}</div>
                      {result.causedBy && (
                        <div className="disease-pathogen">Caused by: {result.causedBy}</div>
                      )}
                    </div>
                    <div>
                      <span className={`severity-badge ${severityBadgeClass}`}>
                        {result.severity || "Normal"}
                      </span>
                    </div>
                  </div>

                  {/* Confidence Meter */}
                  <div className="conf-meter-wrap">
                    <div className="conf-meter-header">
                      <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Confidence Match</span>
                      <strong style={{ color: confScore > 80 ? "var(--green-mid)" : "var(--text)" }}>
                        {confScore}%
                      </strong>
                    </div>
                    <div className="conf-bar-track">
                      <div
                        className="conf-bar-fill"
                        style={{
                          width: `${confScore}%`,
                          background: confScore >= 80 ? "var(--green-mid)" : confScore >= 55 ? "var(--yellow)" : "var(--orange)"
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Severity & Affected Area */}
                <div className="card">
                  <div className="card-title">📊 Severity Level</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                    <span className={`severity-badge ${severityBadgeClass}`}>
                      {result.severity || "Moderate"}
                    </span>
                  </div>
                  <div className="text-muted mt-1" style={{ fontSize: "0.8rem" }}>
                    {result.affectedLeaves ? `Affected leaves: ${result.affectedLeaves}` : "Local lesion distribution"}
                  </div>
                </div>

                {/* 3. Weather Conditions Grid */}
                <div className="card">
                  <div className="card-title">🌦️ Field Micro-Climate</div>
                  <div className="weather-stats-grid">
                    <div className="weather-chip">
                      <div className="weather-chip-icon">🌡️</div>
                      <div className="weather-chip-val">{result.temperature != null ? `${result.temperature}°C` : "--"}</div>
                      <div className="weather-chip-lbl">Temp</div>
                    </div>
                    <div className="weather-chip">
                      <div className="weather-chip-icon">💧</div>
                      <div className="weather-chip-val">{result.humidity != null ? `${result.humidity}%` : "--"}</div>
                      <div className="weather-chip-lbl">Humidity</div>
                    </div>
                    <div className="weather-chip">
                      <div className="weather-chip-icon">💨</div>
                      <div className="weather-chip-val">{result.wind != null ? `${result.wind}` : "--"}</div>
                      <div className="weather-chip-lbl">km/h Wind</div>
                    </div>
                  </div>
                </div>

                {/* 4. Spray Recommendation Hero Card */}
                {result.spray && (
                  <div className={`spray-card full ${result.severity?.toLowerCase().includes("critical") ? "danger" : ""}`}>
                    <div className="spray-title-wrap">
                      <span className="spray-label">🔫 Spray Recommendation</span>
                      <span className="sidebar-badge" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                        CIB&amp;RC Approved
                      </span>
                    </div>
                    <div className="spray-name">{result.spray}</div>

                    <div className="spray-details-chips">
                      {result.spray_quantity && result.spray_quantity !== "N/A" && (
                        <div className="spray-chip">
                          <span>💧 Quantity:</span>
                          <strong>{result.spray_quantity}</strong>
                        </div>
                      )}
                      {result.spray_action_time && result.spray_action_time !== "N/A" && (
                        <div className="spray-chip">
                          <span>⏱️ Timing:</span>
                          <strong>{result.spray_action_time}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Analysis Alert Banner */}
                {result.alert && (
                  <div className="analysis-alert-banner full">
                    <span className="alert-icon">⚠️</span>
                    <div>
                      <strong>Analysis Alert</strong>
                      <div style={{ marginTop: "2px" }}>{result.alert}</div>
                    </div>
                  </div>
                )}

                {/* 6. Spray Safety Warnings */}
                {result.sprayWarnings && result.sprayWarnings.length > 0 && (
                  <div className="spray-warnings-box full">
                    <div className="card-title" style={{ color: "var(--red)" }}>
                      ⚠️ Spray Safety Warnings
                    </div>
                    <ul className="warning-item-list">
                      {result.sprayWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Voice Readout Player Card */}
              <div className="voice-readout-card">
                <div className="voice-title-group">
                  <span className="voice-icon">🔊</span>
                  <div>
                    <strong>Voice Advisory Player</strong>
                    <p>Listen to diagnosis and spray instructions out loud</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <select
                    className="form-input"
                    style={{ width: "auto", padding: "0.3rem 0.6rem", fontSize: "0.82rem" }}
                    value={voiceLang}
                    onChange={(e) => setVoiceLang(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="hi">हिंदी (Hindi)</option>
                    <option value="mr">मराठी (Marathi)</option>
                  </select>

                  <button
                    className={`btn ${isPlayingAudio ? "btn-danger" : "btn-primary"}`}
                    onClick={toggleAudioAdvisory}
                    style={{ padding: "0.45rem 0.9rem", fontSize: "0.84rem" }}
                  >
                    {isPlayingAudio ? "⏹️ Stop Audio" : "▶️ Play Advice"}
                  </button>

                  <div className={`audio-wave-visualizer ${isPlayingAudio ? "playing" : ""}`}>
                    <span /><span /><span /><span />
                  </div>
                </div>
              </div>

              {/* Symptoms List */}
              {result.symptoms && result.symptoms.length > 0 && (
                <div className="advice-section">
                  <h3>🔍 Symptoms &amp; Diagnostic Patterns</h3>
                  <ul className="advice-list orange">
                    {result.symptoms.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Treatment Steps */}
              {result.advice && result.advice.length > 0 && (
                <div className="advice-section">
                  <h3>💊 Treatment Steps &amp; Agronomic Action</h3>
                  <ul className="advice-list">
                    {result.advice.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Prevention Tips */}
              {result.prevention && result.prevention.length > 0 && (
                <div className="advice-section">
                  <h3>🛡️ Cultural Prevention Tips</h3>
                  <ul className="advice-list blue">
                    {result.prevention.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AI Agricultural Advisor Chat */}
        <div>
          <div className="section-header">
            <h2>💬 Ask Agri-Advisor</h2>
            <p>Direct questions about treatment, dosage, soil nutrition, or organic remedies</p>
          </div>

          <div className="chat-wrap">
            <div className="chat-header-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span className="pulse-dot" />
                <strong>Agri-AI Agronomist</strong>
              </div>
              {result && (
                <span className="chat-context-pill">
                  🌿 Context: {result.disease}
                </span>
              )}
            </div>

            <div className="chat-messages">
              {chatMsgs.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  {m.text}
                </div>
              ))}
              {chatLoading && (
                <div className="chat-msg bot" style={{ color: "var(--text-muted)" }}>
                  <span className="spinner" style={{ display: "inline-block", marginRight: "6px" }} />
                  Analyzing query...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-input-row">
              <input
                className="chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about fertilizer, organic spray, recovery time..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChatMessage()}
              />
              <button
                className="btn btn-primary"
                onClick={sendChatMessage}
                disabled={chatLoading}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LOCATION PROMPT & VALIDATION MODAL */}
      {showLocModal && (
        <div className="modal-overlay" onClick={() => setShowLocModal(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "460px", padding: "1.5rem" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>
                  📍 Verify Farm Location
                </h3>
                <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: "2px" }}>
                  No GPS metadata was found in this photo. Please enter your location to fetch local weather &amp; spray safety conditions.
                </p>
              </div>
              <button
                className="preview-remove"
                style={{ position: "static" }}
                onClick={() => setShowLocModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="form-group" style={{ marginTop: "0.5rem" }}>
              <label className="form-label">City / Village / District Name</label>
              <input
                type="text"
                className="form-input"
                value={locInput}
                placeholder="e.g. Nashik, Pune, Baramati, Akola"
                onChange={(e) => setLocInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") validateLocation(locInput);
                }}
                disabled={isValidatingLoc}
                autoFocus
              />
            </div>

            {/* Quick Location Pills */}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {["Nashik", "Pune", "Kolhapur", "Solapur", "Nagpur", "Delhi"].map((c) => (
                <button
                  key={c}
                  type="button"
                  className="mini-btn"
                  onClick={() => {
                    setLocInput(c);
                    validateLocation(c);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Validation Feedback */}
            {isValidatingLoc && (
              <div className="status-bar" style={{ margin: "0.5rem 0" }}>
                <span className="spinner" />
                <span>Checking location validity with OpenStreetMap...</span>
              </div>
            )}

            {locError && (
              <div className="form-msg error" style={{ margin: "0.5rem 0" }}>
                {locError}
              </div>
            )}

            {locSuccess && (
              <div className="form-msg success" style={{ margin: "0.5rem 0" }}>
                {locSuccess}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                className="btn btn-primary btn-full"
                onClick={() => validateLocation(locInput)}
                disabled={isValidatingLoc}
              >
                {isValidatingLoc ? "Verifying..." : "✅ Validate & Set Location"}
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: "0.82rem" }}
                  onClick={useDeviceGps}
                  disabled={isValidatingLoc}
                >
                  📡 Use Device GPS
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: "0.82rem" }}
                  onClick={useDefaultDelhi}
                  disabled={isValidatingLoc}
                >
                  🏛️ Delhi (Default)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Camera Modal */}
      {showCamera && (
        <div className="modal-overlay" onClick={closeCamera}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <video ref={videoRef} className="modal-video" autoPlay playsInline />
            <div className="modal-controls">
              <button className="btn btn-primary btn-lg" onClick={snapPhoto}>
                📸 Capture &amp; Analyze
              </button>
              <button className="btn btn-secondary" onClick={flipCamera}>
                🔄 Flip Camera
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
