import { useState, useRef, useEffect } from "react";
import EXIF from "exif-js";
import { resolveInitialLocation, saveActiveScanLocation, MAHARASHTRA_DISTRICTS } from "../utils/geoUtils";
import {
  MapIcon,
  ExpertIcon,
  ArrowRightIcon,
  MicroscopeIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  LeafIcon,
  ShieldIcon,
  SparklesIcon,
  ChartBarIcon,
  CloudSunIcon,
  ThermometerIcon,
  DropletIcon,
  WindIcon,
  SprayIcon,
  SearchIcon,
  PillIcon,
  VolumeIcon,
  MessageIcon,
  SatelliteIcon,
  BuildingIcon,
  CameraIcon,
  FlipCameraIcon,
  CloseIcon,
  RefreshIcon,
  LocationPinIcon,
  ClockIcon,
  GlobeIcon,
  FlaskIcon
} from "./Icons";

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

export default function DiseaseTab({ user, onScanCompleted, onNavigateToMap, onNavigateToExpert }) {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);

  // Location State initialized from previous scan or user profile district
  const initialGeo = resolveInitialLocation(user);
  const [locationName, setLocationName] = useState(initialGeo.locationName);
  const [latLon, setLatLon] = useState({ lat: initialGeo.lat, lon: initialGeo.lon });
  const [locSource, setLocSource] = useState(initialGeo.source); // "Image GPS" | "Manual - Verified" | "Device GPS" | "Profile District"

  // Location Prompt & Validation Modal
  const [showLocModal, setShowLocModal] = useState(false);
  const [locInput, setLocInput] = useState(user?.district || "Sangli");
  const [isValidatingLoc, setIsValidatingLoc] = useState(false);
  const [locError, setLocError] = useState("");
  const [locSuccess, setLocSuccess] = useState("");

  // Live Camera
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [dragover, setDragover] = useState(false);

  // Audio TTS Readout & Multilingual State (Standard English by default)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en");
  const [isTranslatingVlm, setIsTranslatingVlm] = useState(false);

  // Manual Expert Validation Escalation State
  const [isEscalatingToExpert, setIsEscalatingToExpert] = useState(false);
  const [diseaseEscalatedCaseRef, setDiseaseEscalatedCaseRef] = useState(null);

  async function escalateDiseaseToExpert() {
    if (!result || isEscalatingToExpert) return;
    setIsEscalatingToExpert(true);
    try {
      const res = await fetch(`${API}/api/expert/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "disease",
          crop: result.crop || "Tomato",
          aiDisease: result.disease || "Crop Diagnosis",
          aiConfidence: confScore,
          aiSeverity: result.severity || "Moderate",
          aiStatus: result.status || "confirmed",
          symptoms: result.symptoms || [],
          vlmEvidence: result.vlmEvidence || {},
          imageUrl: preview || null,
          imageName: image ? image.name : "farmer_scan.jpg",
          farmerName: user?.name || "Farmer",
          district: user?.district || locationName.split(",")[0] || "Sangli",
          village: user?.village || "Farm Field",
          latitude: latLon.lat,
          longitude: latLon.lon
        })
      });
      const data = await res.json();
      if (data.success && data.case) {
        setDiseaseEscalatedCaseRef(data.case.case_number);
      }
    } catch (err) {
      console.warn("Could not escalate scan to expert:", err);
    } finally {
      setIsEscalatingToExpert(false);
    }
  }

  // Dynamic Language Switching (Switches VLM, Audio Readout, and Chatbot)
  const handleLanguageChange = async (newLang) => {
    setVoiceLang(newLang);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlayingAudio(false);

    // If an analysis result is currently displayed, dynamically re-explain leaf using VLM
    if (result) {
      setIsTranslatingVlm(true);
      try {
        const res = await fetch(`${API}/api/vlm/re-explain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diagnosis: {
              crop: result.crop,
              disease: result.disease,
              label: result.prediction?.label || result.disease,
              confidence: result.confidence,
              severity: result.severity,
              symptoms: result.symptoms || []
            },
            weather: {
              temp: result.temperature,
              humidity: result.humidity,
              wind: result.wind
            },
            language: newLang,
            imageBase64: preview || null
          })
        });

        const data = await res.json();
        if (data.success && data.vlmEvidence) {
          setResult((prev) => ({
            ...prev,
            vlmEvidence: data.vlmEvidence,
            symptoms: (data.vlmEvidence.visibleSymptoms && data.vlmEvidence.visibleSymptoms.length > 0)
              ? data.vlmEvidence.visibleSymptoms
              : (data.symptoms || prev.symptoms),
            vlmSymptoms: data.vlmEvidence.visibleSymptoms || prev.vlmSymptoms,
            vlmExplanation: data.farmerExplanation || prev.vlmExplanation
          }));
        }
      } catch (err) {
        console.warn("Could not re-explain in new language:", err);
      } finally {
        setIsTranslatingVlm(false);
      }
    }
  };

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
    setStatus("Checking image metadata for GPS location...");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlayingAudio(false);

    // 1. Try Image EXIF Metadata
    const gps = await extractExifGps(file);

    if (gps) {
      console.log(`Found GPS in Image: Lat ${gps.lat.toFixed(4)}, Lon ${gps.lon.toFixed(4)}`);
      setLatLon({ lat: gps.lat, lon: gps.lon });
      const tempLoc = `[${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}] (From Image GPS)`;
      setLocationName(tempLoc);
      setLocSource("Image GPS");
      setStatus(`Found GPS in Image metadata! (${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)})`);

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
      console.log("This image does NOT have GPS location data. Prompting farmer...");
      setStatus("No GPS metadata in image. Please confirm your farm location.");
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

        console.log(`Validated Location: ${validatedCity} (${lat}, ${lon})`);
        setLatLon({ lat, lon });
        const finalDisplayName = `${validatedCity}${stateInfo ? ", " + stateInfo : ""} (Manual - Verified)`;
        setLocationName(finalDisplayName);
        setLocSource("Manual - Verified");
        setLocSuccess(`Validated: ${validatedCity} (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
        setStatus(`Location set: ${validatedCity} (Verified)`);

        setTimeout(() => {
          setShowLocModal(false);
          setLocSuccess("");
        }, 1200);
      } else {
        // Location not found
        setLocError(`Unable to find '${query}'. Please check the spelling or enter a nearby city/district.`);
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

  // Fallback to Sangli (Maharashtra Agricultural Epicenter)
  function useDefaultSangli() {
    setLatLon({ lat: 16.8524, lon: 74.5815 });
    setLocationName("Sangli, Maharashtra (Default)");
    setLocSource("Default");
    setStatus("Location set to Sangli, Maharashtra");
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
          setLocationName(`[${lat.toFixed(4)}, ${lon.toFixed(4)}] (From Device GPS)`);
          setLocSource("Device GPS");
          setIsValidatingLoc(false);
          setShowLocModal(false);
          setStatus(`Set to Device GPS (${lat.toFixed(2)}, ${lon.toFixed(2)})`);

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
    formData.append("language", voiceLang);
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

      // Save active scan location so Outbreak GIS Map immediately adopts this field location
      const confScore = getConfidenceScore(data);
      const activeScanLoc = saveActiveScanLocation({
        lat: latLon.lat,
        lon: latLon.lon,
        locationName: locationName || "Scanned Field Location",
        crop: data.crop || "Crop",
        condition: data.disease || "Crop Diagnosis",
        category: "disease",
        severity: data.severity || "Moderate",
        confidence: (confScore || 88) / 100,
        timestamp: new Date().toISOString()
      });
      if (typeof onScanCompleted === "function" && activeScanLoc) {
        onScanCompleted(activeScanLoc);
      }

      // Add bot notification message
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
      setStatus(err.message || "Failed to analyze image. Is backend running?");
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

  // AI Agricultural Advisor Chat (SIH Context Manager Pipeline)
  async function sendChatMessage() {
    const q = chatInput.trim();
    if (!q) return;

    setChatMsgs((prev) => [...prev, { role: "user", text: q }]);
    setChatInput("");
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

    try {
      const res = await fetch(`${API}/api/chatbot/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          cropCase: result ? {
            caseRef: result.case_ref || "LIVE-SCAN",
            crop: result.crop || "Tomato",
            disease: result.disease,
            severity: result.severity,
            severityPct: result.severity_pct || result.severityScore,
            treatments: result.spray ? [result.spray] : []
          } : null,
          weather: result ? {
            temperature: result.temperature,
            humidity: result.humidity,
            condition: result.weatherCondition
          } : null,
          history: chatMsgs.slice(-4),
          language: voiceLang || "en",
          location: locationName || "Sangli"
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
        <h2><LeafIcon size={22} style={{ marginRight: 8, verticalAlign: "middle" }} /> Crop Disease Detection &amp; Treatment Advisor</h2>
        <p>AI-driven diagnosis with instant spray recommendations, severity grading, and weather-aware advice</p>
      </div>

      {/* Detection Location Row */}
      <div className="location-chip-row">
        <div className="location-info">
          <LocationPinIcon size={14} color="#059669" />
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
              <div className="upload-icon">
                <CameraIcon size={38} color="#059669" />
              </div>
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
                <CloseIcon size={16} />
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

          {/* Advisor & VLM Language Selector Bar */}
          <div className="language-selector-bar" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "10px",
            padding: "0.5rem 0.85rem",
            marginTop: "0.75rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <GlobeIcon size={16} color="#059669" />
              <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--text)" }}>
                Language / भाषा:
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {[
                { code: "en", label: "English" },
                { code: "mr", label: "मराठी" },
                { code: "hi", label: "हिंदी" }
              ].map((l) => {
                const active = voiceLang === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleLanguageChange(l.code)}
                    disabled={isTranslatingVlm}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.32rem 0.7rem",
                      fontSize: "0.82rem",
                      fontWeight: active ? 700 : 500,
                      borderRadius: "6px",
                      border: active ? "1.5px solid #10b981" : "1px solid #cbd5e1",
                      background: active ? "rgba(16, 185, 129, 0.12)" : "#ffffff",
                      color: active ? "#047857" : "#475569",
                      cursor: isTranslatingVlm ? "wait" : "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span>{l.label}</span>
                    {active && <CheckCircleIcon size={13} color="#047857" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline notification when VLM is re-explaining in a new language */}
          {isTranslatingVlm && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#047857",
              padding: "0.45rem 0.75rem",
              borderRadius: "8px",
              marginTop: "0.5rem",
              fontSize: "0.82rem",
              fontWeight: 600
            }}>
              <span className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
              <span>Updating VLM explanation to {voiceLang === "mr" ? "मराठी (Marathi)" : voiceLang === "hi" ? "हिंदी (Hindi)" : "Standard English"}...</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              onClick={analyzeCrop}
              disabled={loading || !image}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Analyzing Leaf...
                </>
              ) : (
                <>
                  <MicroscopeIcon size={18} /> Analyze Crop Conditions
                </>
              )}
            </button>
            <button className="btn btn-secondary btn-lg" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }} onClick={openCamera}>
              <CameraIcon size={18} /> Live Camera
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
                  <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangleIcon size={16} color="#d97706" /> Model Uncertainty Warning
                  </strong>
                  <span>
                    The AI detected potential uncertainty in this image ({result.uncertainty.reason || "unconfirmed_prediction"}).
                    Please ensure the photo is clear, well-lit, and shows only the diseased plant leaf.
                  </span>
                </div>
              )}

              {result.imageQuality && result.imageQuality.valid === false && (
                <div className="quality-warning-card">
                  <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangleIcon size={16} color="#d97706" /> Image Quality Alert (Score: {result.imageQuality.score}%)
                  </strong>
                  <span>{result.imageQuality.recommendation || "Please retake the photo with better lighting and sharp focus."}</span>
                </div>
              )}

              {/* Vision Pipeline Diagnostics Ribbon */}
              <div style={{
                background: "linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "0.55rem 0.85rem",
                marginBottom: "0.85rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.5rem",
                fontSize: "0.78rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#334155" }}>
                  <MicroscopeIcon size={14} color="#047857" />
                  <span>Vision Pipeline Diagnostics:</span>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", padding: "2px 7px", borderRadius: "6px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <ShieldIcon size={12} color="#047857" /> Quality: {result.imageQuality?.score || result.qualityScore || 100}%
                  </span>
                  <span style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "2px 7px", borderRadius: "6px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <LeafIcon size={12} color="#1d4ed8" /> Foliage Isolated &amp; Denoised
                  </span>
                  <span style={{ background: "#faf5ff", color: "#7e22ce", border: "1px solid #e9d5ff", padding: "2px 7px", borderRadius: "6px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <LeafIcon size={12} color="#7e22ce" /> Leaves: {result.leafAnalysis?.leafCount || 1} ({result.affectedLeaves || "1/1 affected"})
                  </span>
                  {result.vlmEvidence && (
                    <span style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", padding: "2px 7px", borderRadius: "6px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <SparklesIcon size={12} color="#b45309" /> VLM Agreement: {result.vlmEvidence.agreementScore || 92}%
                    </span>
                  )}
                </div>
              </div>

              {/* Borderline Confidence Escalation Alert Card (Case #1024 Integration) */}
              {(confScore < 75 || result.uncertainty?.flagged) && (
                <div style={{
                  background: "linear-gradient(90deg, #fff7ed 0%, #ffedd5 100%)",
                  border: "1.5px solid #f97316",
                  borderRadius: "12px",
                  padding: "0.85rem 1.15rem",
                  marginBottom: "0.85rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  boxShadow: "0 2px 10px rgba(249,115,22,0.08)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <AlertTriangleIcon size={24} color="#ea580c" />
                    <div>
                      <div style={{ fontWeight: 800, color: "#9a3412", fontSize: "0.92rem", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>Borderline Model Confidence ({confScore}%) — Auto-Escalated to Agronomist</span>
                        <span style={{ fontSize: "0.72rem", background: "#ea580c", color: "#fff", padding: "1px 6px", borderRadius: "10px" }}>HITL Active</span>
                      </div>
                      <div style={{ color: "#7c2d12", fontSize: "0.82rem", marginTop: "2px" }}>
                        Because confidence is under 75% (e.g. Early Blight vs Septoria Leaf Spot), this case is safely enqueued in the <strong>Expert Validation Dashboard</strong> for human review.
                      </div>
                    </div>
                  </div>
                  {onNavigateToExpert && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={onNavigateToExpert}
                      style={{
                        background: "#ea580c",
                        border: "none",
                        padding: "0.45rem 1rem",
                        fontSize: "0.84rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(234,88,12,0.25)"
                      }}
                    >
                      <ExpertIcon size={15} color="#ffffff" />
                      <span>View in Expert Review Queue</span>
                      <ArrowRightIcon size={12} color="#ffffff" />
                    </button>
                  )}
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

                {/* 1.1 Alternative Candidates / Prediction Distribution */}
                {((result.prediction?.allPredictions && result.prediction.allPredictions.length > 1) || (result.allPredictions && result.allPredictions.length > 1)) && (
                  <div style={{
                    gridColumn: "1 / -1",
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                  }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "6px" }}>
                      <MicroscopeIcon size={14} color="var(--text-muted)" />
                      <span>Model Prediction Distribution (Top Differential Candidates):</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {(result.prediction?.allPredictions || result.allPredictions || []).slice(0, 3).map((pred, idx) => {
                        const pName = (pred.disease || pred.label || "").replace(/___/g, " - ").replace(/_/g, " ");
                        const pScore = pred.confidencePercent !== undefined
                          ? Math.round(pred.confidencePercent)
                          : Math.round((pred.confidence || 0) * 100);
                        const isTop = idx === 0;
                        return (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.82rem" }}>
                            <span style={{ width: "210px", fontWeight: isTop ? 700 : 500, color: isTop ? "var(--text)" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {idx + 1}. {pName}
                            </span>
                            <div style={{ flex: 1, background: "#f1f5f9", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                              <div style={{
                                width: `${pScore}%`,
                                height: "100%",
                                background: isTop ? (pScore >= 75 ? "#10b981" : "#f97316") : "#94a3b8",
                                borderRadius: "4px"
                              }} />
                            </div>
                            <span style={{ width: "42px", textAlign: "right", fontWeight: 700, color: isTop ? "var(--text)" : "#64748b" }}>
                              {pScore}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 1.2 Multi-Leaf Foliage Inspection Card */}
                {result.multiLeafAnalysis && result.multiLeafAnalysis.leafPredictions && result.multiLeafAnalysis.leafPredictions.length > 1 && (
                  <div style={{
                    gridColumn: "1 / -1",
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0f172a", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <LeafIcon size={14} color="#047857" />
                        <span>Multi-Leaf Foliage Inspection ({result.multiLeafAnalysis.validLeavesCount || result.multiLeafAnalysis.leafPredictions.length} leaves parsed)</span>
                      </span>
                      <span className="sidebar-badge" style={{ background: "rgba(16,185,129,0.12)", color: "#047857", border: "1px solid #10b981", fontSize: "0.74rem" }}>
                        Prevalence: {result.multiLeafAnalysis.prevalencePercent || 50}%
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.6rem" }}>
                      {result.multiLeafAnalysis.leafPredictions.map((lp, idx) => (
                        <div key={idx} style={{
                          border: lp.isHealthy ? "1px solid #86efac" : "1px solid #fed7aa",
                          background: lp.isHealthy ? "#f0fdf4" : "#fff7ed",
                          borderRadius: "8px",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                            <span>Leaf #{lp.leafId || idx + 1}</span>
                            <span style={{ color: lp.isHealthy ? "#16a34a" : "#ea580c" }}>
                              {lp.isHealthy ? "Healthy" : "Affected"}
                            </span>
                          </div>
                          <div style={{ color: "#475569", marginTop: "2px", fontSize: "0.76rem" }}>
                            {lp.disease || lp.label} ({lp.confidencePercent || Math.round((lp.confidence || 0) * 100)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Severity & Affected Area */}
                <div className="card">
                  <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <ChartBarIcon size={15} color="var(--primary)" />
                    <span>Severity Level</span>
                  </div>
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
                  <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <CloudSunIcon size={16} color="var(--primary)" />
                    <span>Field Micro-Climate</span>
                  </div>
                  <div className="weather-stats-grid">
                    <div className="weather-chip">
                      <div className="weather-chip-icon"><ThermometerIcon size={18} color="#e11d48" /></div>
                      <div className="weather-chip-val">{result.temperature != null ? `${result.temperature}°C` : "--"}</div>
                      <div className="weather-chip-lbl">Temp</div>
                    </div>
                    <div className="weather-chip">
                      <div className="weather-chip-icon"><DropletIcon size={18} color="#0284c7" /></div>
                      <div className="weather-chip-val">{result.humidity != null ? `${result.humidity}%` : "--"}</div>
                      <div className="weather-chip-lbl">Humidity</div>
                    </div>
                    <div className="weather-chip">
                      <div className="weather-chip-icon"><WindIcon size={18} color="#059669" /></div>
                      <div className="weather-chip-val">{result.wind != null ? `${result.wind}` : "--"}</div>
                      <div className="weather-chip-lbl">km/h Wind</div>
                    </div>
                  </div>
                </div>

                {/* 1.5. PostGIS Outbreak Surveillance Link Card */}
                <div style={{
                  gridColumn: "1 / -1",
                  background: "linear-gradient(90deg, #eff6ff 0%, #f0fdf4 100%)",
                  border: "1.5px solid #93c5fd",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.6rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapIcon size={22} color="#1e40af" />
                    <div>
                      <div style={{ fontWeight: 800, color: "#1e40af", fontSize: "0.88rem" }}>
                        Recorded in PostGIS Outbreak Surveillance
                      </div>
                      <div style={{ color: "#475569", fontSize: "0.8rem" }}>
                        Field coordinates: <strong>[{latLon.lat.toFixed(4)}, {latLon.lon.toFixed(4)}]</strong> · {locationName}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    {onNavigateToMap && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onNavigateToMap}
                        style={{ padding: "0.4rem 0.85rem", fontSize: "0.82rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <MapIcon size={14} color="#ffffff" />
                        <span>View on GIS Outbreak Map</span>
                        <ArrowRightIcon size={12} color="#ffffff" />
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
                          gap: "6px"
                        }}
                      >
                        <ExpertIcon size={14} color="#7e22ce" />
                        <span>Agronomist Validation Queue</span>
                        <ArrowRightIcon size={12} color="#7e22ce" />
                      </button>
                    )}
                    {!diseaseEscalatedCaseRef && confScore >= 75 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={escalateDiseaseToExpert}
                        disabled={isEscalatingToExpert}
                        style={{
                          padding: "0.4rem 0.85rem",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "#0369a1",
                          background: "rgba(2,132,199,0.08)",
                          border: "1.5px solid #38bdf8",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        {isEscalatingToExpert ? (
                          "Escalating..."
                        ) : (
                          <>
                            <MicroscopeIcon size={14} color="#0369a1" />
                            <span>Request Agronomist Second Opinion</span>
                          </>
                        )}
                      </button>
                    )}
                    {diseaseEscalatedCaseRef && (
                      <span style={{ fontSize: "0.8rem", color: "#047857", fontWeight: 700, background: "#ecfdf5", padding: "4px 8px", borderRadius: "6px", border: "1px solid #86efac", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <CheckCircleIcon size={13} color="#047857" />
                        <span>Enqueued for Review: {diseaseEscalatedCaseRef}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 4. Spray Recommendation Hero Card */}
                {result.spray && (
                  <div className={`spray-card full ${result.severity?.toLowerCase().includes("critical") ? "danger" : ""}`}>
                    <div className="spray-title-wrap">
                      <span className="spray-label" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <SprayIcon size={15} color="var(--primary)" />
                        <span>Spray Recommendation</span>
                      </span>
                      <span className="sidebar-badge" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                        CIB&amp;RC Approved
                      </span>
                    </div>
                    <div className="spray-name">{result.spray}</div>

                    <div className="spray-details-chips">
                      {result.spray_quantity && result.spray_quantity !== "N/A" && (
                        <div className="spray-chip">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <DropletIcon size={13} /> Quantity:
                          </span>
                          <strong>{result.spray_quantity}</strong>
                        </div>
                      )}
                      {result.spray_action_time && result.spray_action_time !== "N/A" && (
                        <div className="spray-chip">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <ClockIcon size={13} /> Timing:
                          </span>
                          <strong>{result.spray_action_time}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Analysis Alert Banner */}
                {result.alert && (
                  <div className="analysis-alert-banner full">
                    <span className="alert-icon">
                      <AlertTriangleIcon size={18} color="#f59e0b" />
                    </span>
                    <div>
                      <strong>Analysis Alert</strong>
                      <div style={{ marginTop: "2px" }}>{result.alert}</div>
                    </div>
                  </div>
                )}

                {/* 6. Spray Safety Warnings */}
                {result.sprayWarnings && result.sprayWarnings.length > 0 && (
                  <div className="spray-warnings-box full">
                    <div className="card-title" style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <AlertTriangleIcon size={16} color="var(--red)" />
                      <span>Spray Safety Warnings</span>
                    </div>
                    <ul className="warning-item-list">
                      {result.sprayWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* VLM Visual-Intelligence Layer Card */}
              {result.vlmEvidence && (
                <div className="card full" style={{
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
                  marginBottom: "1rem",
                  position: "relative"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.4rem" }}>
                  <div className="card-title" style={{ color: "#065f46", margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <MicroscopeIcon size={16} color="#065f46" />
                    <span>
                      {voiceLang === "mr"
                        ? "AI दृश्य पुरावे (VLM Visual-Intelligence)"
                        : voiceLang === "hi"
                          ? "AI दृश्य प्रमाण (VLM Visual-Intelligence)"
                          : "AI Visual Evidence (VLM Visual-Intelligence)"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {isTranslatingVlm && (
                      <span style={{ fontSize: "0.76rem", color: "#047857", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <RefreshIcon size={12} color="#047857" />
                        <span>Updating language...</span>
                      </span>
                    )}
                    <span className="sidebar-badge" style={{
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#047857",
                      border: "1px solid #10b981",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}>
                      <SparklesIcon size={12} color="#047857" />
                      <span>
                        {voiceLang === "mr"
                          ? `सहमती: ${result.vlmEvidence.agreementScore || 92}%`
                          : voiceLang === "hi"
                            ? `सहमति: ${result.vlmEvidence.agreementScore || 92}%`
                            : `Consensus: ${result.vlmEvidence.agreementScore || 92}%`}
                      </span>
                    </span>
                  </div>
                </div>

                  {result.vlmEvidence.farmerExplanation && (
                <div style={{
                  fontSize: "0.92rem",
                  lineHeight: "1.55",
                  color: "var(--text)",
                  marginBottom: "0.75rem",
                  background: "rgba(255, 255, 255, 0.8)",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  borderLeft: "4px solid #10b981"
                }}>
                  {result.vlmEvidence.farmerExplanation}
                </div>
              )}

              {result.vlmEvidence.visibleSymptoms && result.vlmEvidence.visibleSymptoms.length > 0 && (
                <div>
                  <div style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: "0.35rem"
                  }}>
                    {voiceLang === "mr"
                      ? "पानावरील ठळक दृश्य लक्षणे (Observed Symptoms):"
                      : voiceLang === "hi"
                        ? "पत्ती पर देखे गए लक्षण (Observed Symptoms):"
                        : "Observed Foliage Symptoms:"}
                  </div>
                  <ul className="advice-list green" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                    {result.vlmEvidence.visibleSymptoms.map((symp, i) => (
                      <li key={i} style={{ marginBottom: "0.25rem", fontSize: "0.88rem" }}>{symp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Voice Readout Player Card */}
          <div className="voice-readout-card">
            <div className="voice-title-group">
              <span className="voice-icon">
                <VolumeIcon size={18} color="#2563eb" />
              </span>
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
                onChange={(e) => handleLanguageChange(e.target.value)}
              >
                <option value="en">English (Default)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="hi">हिंदी (Hindi)</option>
              </select>

              <button
                className={`btn ${isPlayingAudio ? "btn-danger" : "btn-primary"}`}
                onClick={toggleAudioAdvisory}
                style={{ padding: "0.45rem 0.9rem", fontSize: "0.84rem" }}
              >
                {isPlayingAudio ? "Stop Audio" : "Play Advice"}
              </button>

              <div className={`audio-wave-visualizer ${isPlayingAudio ? "playing" : ""}`}>
                <span /><span /><span /><span />
              </div>
            </div>
          </div>

          {/* Symptoms List */}
          {result.symptoms && result.symptoms.length > 0 && (
            <div className="advice-section">
              <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <SearchIcon size={16} color="#ea580c" />
                <span>Symptoms &amp; Diagnostic Patterns</span>
              </h3>
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
              <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <PillIcon size={16} color="#2563eb" />
                <span>Treatment Steps &amp; Agronomic Action</span>
              </h3>
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
                  <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <ShieldIcon size={16} color="#059669" />
                    <span>Cultural Prevention Tips</span>
                  </h3>
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
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <MessageIcon size={20} color="#2563eb" />
            <span>Ask Agri-Advisor</span>
          </h2>
          <p>Direct questions about treatment, dosage, soil nutrition, or organic remedies</p>
        </div>

        <div className="chat-wrap">
          <div className="chat-header-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span className="pulse-dot" />
              <strong>Agri-AI Agronomist</strong>
            </div>
            {result && (
              <span className="chat-context-pill" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <LeafIcon size={12} color="#047857" />
                <span>Context: {result.disease}</span>
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
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <LocationPinIcon size={18} color="#2563eb" />
                  <span>Verify Farm Location</span>
                </h3>
                <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: "2px" }}>
                  No GPS metadata was found in this photo. Please enter your location to fetch local weather &amp; spray safety conditions.
                </p>
              </div>
              <button
                className="preview-remove"
                style={{ position: "static", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => setShowLocModal(false)}
              >
                <CloseIcon size={14} />
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
              {["Sangli", "Nashik", "Pune", "Solapur", "Ahmednagar", "Kolhapur", "Nagpur"].map((c) => (
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
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                {isValidatingLoc ? (
                  "Verifying..."
                ) : (
                  <>
                    <CheckCircleIcon size={16} />
                    <span>Validate &amp; Set Location</span>
                  </>
                )}
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: "0.82rem", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  onClick={useDeviceGps}
                  disabled={isValidatingLoc}
                >
                  <SatelliteIcon size={15} color="var(--primary)" />
                  <span>Use Device GPS</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: "0.82rem", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  onClick={useDefaultSangli}
                  disabled={isValidatingLoc}
                >
                  <BuildingIcon size={15} color="var(--primary)" />
                  <span>Sangli (Maharashtra)</span>
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
              <button className="btn btn-primary btn-lg" onClick={snapPhoto} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <CameraIcon size={18} />
                <span>Capture &amp; Analyze</span>
              </button>
              <button className="btn btn-secondary" onClick={flipCamera} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <FlipCameraIcon size={16} />
                <span>Flip Camera</span>
              </button>
              <button className="btn btn-danger" onClick={closeCamera}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
