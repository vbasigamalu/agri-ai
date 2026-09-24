import { useState, useEffect } from "react";

const API = "";

function getSeverityBadgeClass(sev) {
  const s = (sev || "").toLowerCase();
  if (s.includes("critical")) return "severity-critical";
  if (s.includes("severe") || s.includes("major")) return "severity-severe";
  if (s.includes("moderate")) return "severity-moderate";
  if (s.includes("mild")) return "severity-mild";
  return "severity-healthy";
}

export default function HistoryTab({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedScan, setSelectedScan] = useState(null);

  useEffect(() => {
    loadScanHistory();
  }, [user]);

  async function loadScanHistory() {
    setLoading(true);
    let combined = [];

    // 1. Read from localStorage cache
    try {
      const local = JSON.parse(localStorage.getItem("agri_local_history") || "[]");
      if (Array.isArray(local)) combined = [...local];
    } catch (e) {
      console.warn("Could not parse local history:", e);
    }

    // 2. Fetch from Backend / MongoDB
    try {
      const headers = {};
      if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;
      const res = await fetch(`${API}/history`, { headers });
      if (res.ok) {
        const remote = await res.json();
        if (Array.isArray(remote)) {
          // Merge remote items, avoid duplicate timestamps
          remote.forEach((r) => {
            const exists = combined.some((c) => c.timestamp === r.timestamp || c._id === r._id);
            if (!exists) {
              combined.push({
                _id: r._id,
                timestamp: r.timestamp || r.createdAt,
                crop: r.crop || "Crop",
                diseaseName: r.diseaseName || r.disease || "Unknown",
                confidence: typeof r.confidence === "number" && r.confidence <= 1 ? Math.round(r.confidence * 100) : (r.confidence || 85),
                severity: r.severity || "Moderate",
                causedBy: r.causedBy || "Pathogen",
                temperature: r.temperature != null ? r.temperature : 25,
                humidity: r.humidity != null ? r.humidity : 60,
                spray: r.spray || "N/A",
                sprayWarnings: r.sprayWarnings || [],
                alert: r.alert || "",
                advice: r.advice || [],
                prevention: r.prevention || [],
                symptoms: r.symptoms || []
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("Remote history fetch failed (using local cache):", e.message);
    }

    // Sort by timestamp descending
    combined.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    setHistory(combined);
    setLoading(false);
  }

  function clearHistory() {
    if (confirm("Are you sure you want to clear your local scan history?")) {
      localStorage.removeItem("agri_local_history");
      setHistory([]);
    }
  }

  const filteredHistory = history.filter((item) => {
    const q = filter.toLowerCase();
    const disease = (item.diseaseName || item.disease || "").toLowerCase();
    const crop = (item.crop || "").toLowerCase();
    return disease.includes(q) || crop.includes(q);
  });

  return (
    <div>
      <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>📜 Crop Scan History</h2>
          <p>Review past crop diagnostic scans, spray records, and environmental conditions</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={loadScanHistory} disabled={loading}>
            🔄 Refresh
          </button>
          {history.length > 0 && (
            <button className="btn btn-danger" onClick={clearHistory}>
              🗑️ Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter search */}
      <div style={{ marginBottom: "1.25rem", maxWidth: "420px" }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Filter by crop or disease name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <span className="spinner" style={{ width: "24px", height: "24px", margin: "0 auto 0.75rem" }} />
          <p className="text-muted">Loading your past crop scans...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
          <div style={{ fontSize: "2.8rem", marginBottom: "0.5rem" }}>🌿</div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>No Scan History Yet</h3>
          <p className="text-muted mt-1" style={{ maxWidth: "420px", margin: "0.4rem auto 1.25rem" }}>
            Upload or capture a leaf photo in the Disease Detection tab. Your analysis results and treatment advice will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="history-grid">
          {filteredHistory.map((item, idx) => {
            const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Recent Scan";
            const badgeClass = getSeverityBadgeClass(item.severity);
            const conf = item.confidence || 0;

            return (
              <div key={item._id || idx} className="history-card">
                <div>
                  <div className="history-card-header">
                    <span className="history-date">📅 {dateStr}</span>
                    <span className={`severity-badge ${badgeClass}`}>{item.severity || "Normal"}</span>
                  </div>

                  <div className="history-disease-title">
                    {item.diseaseName || item.disease}
                  </div>
                  {item.crop && (
                    <div style={{ fontSize: "0.8rem", color: "var(--green-mid)", fontWeight: 600, marginBottom: "0.35rem" }}>
                      🌱 Crop: {item.crop}
                    </div>
                  )}

                  <div className="history-card-body">
                    {item.alert ? (
                      <p>{item.alert}</p>
                    ) : item.spray && item.spray !== "N/A" ? (
                      <p>🔫 Spray: <strong>{item.spray}</strong></p>
                    ) : (
                      <p className="text-muted">Healthy or standard monitoring</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="history-meta-row">
                    <span>🎯 {conf}% Match</span>
                    <span>🌡️ {item.temperature}°C</span>
                    <span>💧 {item.humidity}%</span>
                  </div>

                  <button
                    className="btn btn-secondary btn-full"
                    style={{ marginTop: "0.75rem", fontSize: "0.82rem", padding: "0.45rem" }}
                    onClick={() => setSelectedScan(item)}
                  >
                    👁️ View Full Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {selectedScan && (
        <div className="modal-overlay" onClick={() => setSelectedScan(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ padding: "1.5rem", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <span className={`severity-badge ${getSeverityBadgeClass(selectedScan.severity)}`} style={{ marginBottom: "0.35rem" }}>
                  {selectedScan.severity || "Normal"}
                </span>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text)" }}>
                  {selectedScan.diseaseName || selectedScan.disease}
                </h3>
                <small className="text-muted">
                  Recorded: {new Date(selectedScan.timestamp).toLocaleString()}
                </small>
              </div>
              <button className="preview-remove" style={{ position: "static" }} onClick={() => setSelectedScan(null)}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <span className="spray-chip">🎯 Confidence: <strong>{selectedScan.confidence}%</strong></span>
              <span className="spray-chip">🌡️ Temp: <strong>{selectedScan.temperature}°C</strong></span>
              <span className="spray-chip">💧 Humidity: <strong>{selectedScan.humidity}%</strong></span>
            </div>

            {selectedScan.spray && selectedScan.spray !== "N/A" && (
              <div className="spray-card" style={{ marginBottom: "1rem" }}>
                <span className="spray-label">🔫 Spray Recommendation</span>
                <div className="spray-name" style={{ marginTop: "0.2rem" }}>{selectedScan.spray}</div>
                {selectedScan.spray_quantity && (
                  <div className="text-muted mt-1" style={{ fontSize: "0.82rem" }}>
                    Dosage: {selectedScan.spray_quantity} · Timing: {selectedScan.spray_action_time || "Morning / Evening"}
                  </div>
                )}
              </div>
            )}

            {selectedScan.advice && selectedScan.advice.length > 0 && (
              <div className="advice-section" style={{ marginTop: "0.5rem" }}>
                <h3>💊 Treatment Advice</h3>
                <ul className="advice-list">
                  {selectedScan.advice.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            {selectedScan.prevention && selectedScan.prevention.length > 0 && (
              <div className="advice-section" style={{ marginTop: "0.75rem" }}>
                <h3>🛡️ Prevention Tips</h3>
                <ul className="advice-list blue">
                  {selectedScan.prevention.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: "1.25rem" }}
              onClick={() => setSelectedScan(null)}
            >
              Close Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
