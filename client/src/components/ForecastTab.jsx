import { useState } from "react";
import {
  ForecastIcon,
  LeafIcon,
  ThermometerIcon,
  PestIcon,
  ClipboardListIcon
} from "./Icons";

const API = "";

function RiskBar({ label, score, level }) {
  const cls = `risk-${(level||"low").toLowerCase()}`;
  return (
    <div className="risk-row">
      <div className="risk-row-header">
        <span>{label}</span>
        <span style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
          <span style={{ fontWeight:700 }}>{score}%</span>
          <span className={`level-pill level-${level}`}>{level}</span>
        </span>
      </div>
      <div className="risk-bar-track">
        <div className={`risk-bar-fill ${cls}`} style={{ width:`${score}%` }} />
      </div>
    </div>
  );
}

export default function ForecastTab() {
  const [form, setForm] = useState({
    crop:"Tomato", cropStage:"Flowering", district:"Pune",
    temp:"26", humidity:"75", rainfall:"5", wind:"15", dewPoint:"",
    aphids:"0", mites:"0", armyworm:"0",
    diseaseHistory:"", forecastDays:"3"
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");
  const [showDemo, setShowDemo] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function runForecast(demo=false) {
    setLoading(true); setError(""); setResult(null);
    try {
      const url = demo ? `${API}/api/forecast/risk/demo` : `${API}/api/forecast/risk`;
      const opts = demo ? { method:"GET" } : {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          weather:{
            temp_c: parseFloat(form.temp)||25,
            humidity_pct: parseFloat(form.humidity)||60,
            rainfall_mm: parseFloat(form.rainfall)||0,
            wind_kmh: parseFloat(form.wind)||15,
            ...(form.dewPoint ? { dew_point_c: parseFloat(form.dewPoint) } : {})
          },
          crop: form.crop,
          cropStage: form.cropStage,
          location:{ district: form.district },
          pestCount:{
            aphids: parseInt(form.aphids)||0,
            mites: parseInt(form.mites)||0,
            armyworm: parseInt(form.armyworm)||0
          },
          diseaseHistory: form.diseaseHistory.trim()
            ? [{ disease: form.diseaseHistory, daysAgo:5, severity:"Moderate" }] : [],
          forecastDays: parseInt(form.forecastDays)||3
        })
      };
      const r = await fetch(url, opts);
      const d = await r.json();
      if (d.success) setResult(d);
      else setError(d.error || "Forecast failed");
    } catch { setError("Network error. Is the server running?"); }
    finally { setLoading(false); }
  }

  const overallColor = result ? `level-${result.overallRisk?.level}` : "";

  return (
    <div>
      <div className="section-header">
        <h2><ForecastIcon size={22} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Risk Forecast</h2>
        <p>Predict disease &amp; pest risk for the next 1–7 days based on weather, crop stage, and field history</p>
      </div>

      <div className="two-col">
        <div>
          <div className="card mb-2">
            <div className="card-title mb-1" style={{ fontSize:"0.82rem", fontWeight:600, color:"var(--text)", textTransform:"none", letterSpacing:0, display: "flex", alignItems: "center", gap: "6px" }}>
              <LeafIcon size={15} color="var(--primary)" /> Crop Details
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Crop</label>
                <select className="form-input" value={form.crop} onChange={set("crop")}>
                  {["Tomato","Cotton","Wheat","Rice","Potato","Onion","Chilli","Sugarcane","Maize"].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Growth Stage</label>
                <select className="form-input" value={form.cropStage} onChange={set("cropStage")}>
                  {["Seedling","Vegetative","Flowering","Fruiting","Harvest"].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District</label>
                <input className="form-input" value={form.district} onChange={set("district")} placeholder="Pune" />
              </div>
              <div className="form-group">
                <label className="form-label">Forecast Days</label>
                <select className="form-input" value={form.forecastDays} onChange={set("forecastDays")}>
                  {[1,2,3,5,7].map(n=><option key={n} value={n}>{n} day{n>1?"s":""}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card mb-2">
            <div className="card-title mb-1" style={{ fontSize:"0.82rem", fontWeight:600, color:"var(--text)", textTransform:"none", letterSpacing:0, display: "flex", alignItems: "center", gap: "6px" }}>
              <ThermometerIcon size={15} color="#0284c7" /> Weather Conditions
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Temperature (°C)</label>
                <input className="form-input" type="number" value={form.temp} onChange={set("temp")} placeholder="26" />
              </div>
              <div className="form-group">
                <label className="form-label">Humidity (%)</label>
                <input className="form-input" type="number" value={form.humidity} onChange={set("humidity")} placeholder="75" />
              </div>
              <div className="form-group">
                <label className="form-label">Rainfall (mm)</label>
                <input className="form-input" type="number" value={form.rainfall} onChange={set("rainfall")} placeholder="5" />
              </div>
              <div className="form-group">
                <label className="form-label">Wind (km/h)</label>
                <input className="form-input" type="number" value={form.wind} onChange={set("wind")} placeholder="15" />
              </div>
            </div>
          </div>

          <div className="card mb-2">
            <div className="card-title mb-1" style={{ fontSize:"0.82rem", fontWeight:600, color:"var(--text)", textTransform:"none", letterSpacing:0, display: "flex", alignItems: "center", gap: "6px" }}>
              <PestIcon size={15} color="#d97706" /> Pest Count (in traps)
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Aphids</label>
                <input className="form-input" type="number" min={0} value={form.aphids} onChange={set("aphids")} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Mites</label>
                <input className="form-input" type="number" min={0} value={form.mites} onChange={set("mites")} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Armyworm</label>
                <input className="form-input" type="number" min={0} value={form.armyworm} onChange={set("armyworm")} placeholder="0" />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Previous Disease (if any)</label>
            <input className="form-input" value={form.diseaseHistory} onChange={set("diseaseHistory")} placeholder="e.g. Early Blight (leave blank if none)" />
          </div>

          <div style={{ display:"flex", gap:"0.5rem" }}>
            <button className="btn btn-primary btn-lg" style={{ flex:1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }} onClick={() => runForecast(false)} disabled={loading}>
              {loading ? <><span className="spinner" />Forecasting…</> : <><ForecastIcon size={16} /> Run Forecast</>}
            </button>
            <button className="btn btn-secondary" onClick={() => runForecast(true)} disabled={loading}>Demo</button>
          </div>

          {error && <div className="form-msg error mt-1">{error}</div>}
        </div>

        <div>
          {result ? (
            <div>
              {/* Overall risk card */}
              <div className="card mb-2" style={{ borderLeft:`4px solid ${result.overallRisk?.level === "CRITICAL" ? "var(--red)" : result.overallRisk?.level === "HIGH" ? "var(--orange)" : result.overallRisk?.level === "MEDIUM" ? "var(--yellow)" : "var(--green)"}` }}>
                <div className="card-title">Overall Risk — {result.forecast?.days} day forecast</div>
                <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginTop:"0.25rem" }}>
                  <span style={{ fontSize:"2rem", fontWeight:800 }}>{result.overallRisk?.score}%</span>
                  <span className={`level-pill ${overallColor}`} style={{ fontSize:"0.85rem", padding:"0.3rem 0.8rem" }}>{result.overallRisk?.level}</span>
                </div>
                <div className="text-muted mt-1" style={{ fontSize:"0.82rem" }}>{result.forecast?.summary}</div>
              </div>

              {/* Sub-risk bars */}
              <div className="card mb-2">
                <RiskBar label="Disease Risk" score={result.diseaseRisk?.score} level={result.diseaseRisk?.level} />
                <RiskBar label="Pest Risk"    score={result.pestRisk?.score}    level={result.pestRisk?.level} />
              </div>

              {/* Advisory */}
              {result.advisory?.length > 0 && (
                <div className="advice-section">
                  <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <ClipboardListIcon size={18} color="var(--primary)" /> Advisory
                  </h3>
                  <ul className="advice-list">
                    {result.advisory.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              {/* Engine badge */}
              <div style={{ marginTop:"0.75rem", fontSize:"0.72rem", color:"var(--text-muted)", textAlign:"right" }}>
                Engine: {result.meta?.engine || "---"} {result.meta?.fallback ? "(fallback)" : ""}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign:"center", padding:"3rem 1rem" }}>
              <div style={{ marginBottom:"0.5rem", color: "var(--primary)", display: "flex", justifyContent: "center" }}>
                <ForecastIcon size={48} />
              </div>
              <div style={{ fontWeight:600, marginBottom:"0.4rem" }}>Risk Forecast</div>
              <div className="text-muted">Fill in the form and click Run Forecast to see the risk prediction for your crop.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
