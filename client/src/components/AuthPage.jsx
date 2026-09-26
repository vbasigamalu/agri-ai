import { useState } from "react";
import { LeafIcon, UserIcon, ArrowLeftIcon } from "./Icons";

const API = "";

export default function AuthPage({ onLogin, onBackToLanding }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({
    identifier: "", password: "", name: "", district: "", village: "", role: "farmer"
  });
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setMsg({ text: "", type: "" });
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phone_or_email: form.identifier, 
          identifier: form.identifier, 
          password: form.password 
        })
      });
      const d = await r.json();
      if (r.ok && (d.token || d.success)) {
        localStorage.setItem("agri_token", d.token);
        localStorage.setItem("agri_ai_token", d.token);
        const userData = {
          id: d.user?.id,
          name: d.user?.name || "Farmer",
          phone_or_email: d.user?.phone_or_email || form.identifier,
          location: d.user?.district || "Maharashtra",
          district: d.user?.district || "Maharashtra",
          village: d.user?.village || "",
          role: d.user?.role || "farmer",
          token: d.token
        };
        localStorage.setItem("agri_user", JSON.stringify(userData));
        localStorage.setItem("agri_ai_user", JSON.stringify(d.user || userData));
        onLogin(userData);
      } else {
        setMsg({ text: d.error || d.message || "Invalid Phone/Email or Password.", type: "error" });
      }
    } catch {
      setMsg({ text: "Network error. Please check if server is running.", type: "error" });
    } finally { setLoading(false); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true); setMsg({ text: "", type: "" });
    try {
      const r = await fetch(`${API}/api/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone_or_email: form.identifier,
          identifier: form.identifier,
          password: form.password,
          district: form.district,
          village: form.village,
          role: form.role,
          state: "Maharashtra"
        })
      });
      const d = await r.json();
      if (r.ok && (d.token || d.success)) {
        if (d.token) {
          localStorage.setItem("agri_token", d.token);
          localStorage.setItem("agri_ai_token", d.token);
          const userData = {
            id: d.user?.id,
            name: d.user?.name || form.name,
            phone_or_email: d.user?.phone_or_email || form.identifier,
            location: d.user?.district || form.district || "Maharashtra",
            district: d.user?.district || form.district || "Maharashtra",
            village: d.user?.village || form.village || "",
            role: d.user?.role || form.role || "farmer",
            token: d.token
          };
          localStorage.setItem("agri_user", JSON.stringify(userData));
          localStorage.setItem("agri_ai_user", JSON.stringify(d.user || userData));
          onLogin(userData);
        } else {
          setMsg({ text: d.message || "Account created! Please log in.", type: "success" });
          setTab("login");
        }
      } else {
        setMsg({ text: d.error || d.message || "Registration failed", type: "error" });
      }
    } catch {
      setMsg({ text: "Network error. Please check if server is running.", type: "error" });
    } finally { setLoading(false); }
  }

  function guestLogin() {
    const guestUser = { 
      name: "Guest Farmer", 
      location: "Maharashtra", 
      district: "Maharashtra", 
      village: "", 
      role: "farmer", 
      token: null, 
      guest: true 
    };
    localStorage.setItem("agri_user", JSON.stringify(guestUser));
    onLogin(guestUser);
  }

  return (
    <div className="auth-page">
      {onBackToLanding && (
        <div style={{
          width: "100%",
          maxWidth: "420px",
          margin: "0 auto 1rem auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <button
            type="button"
            onClick={onBackToLanding}
            id="auth-go-back-top"
            title="Go Back to Landing Page"
            aria-label="Go Back to Landing Page"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#ffffff",
              border: "1.5px solid #166534",
              color: "#166534",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
              transition: "all 0.15s ease"
            }}
          >
            <ArrowLeftIcon size={20} color="#166534" />
          </button>
          <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}>
            Agri-AI Platform
          </span>
        </div>
      )}

      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <LeafIcon size={28} color="#10b981" />
          </span>
          <h1>Agri-AI</h1>
          <p>Smart Crop Health &amp; Advisory Platform</p>
        </div>

        <div className="auth-tabs-switch">
          <button className={`auth-switch-btn${tab === "login" ? " active" : ""}`} onClick={() => setTab("login")}>Login</button>
          <button className={`auth-switch-btn${tab === "register" ? " active" : ""}`} onClick={() => setTab("register")}>Register</button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Phone Number or Email</label>
              <input className="form-input" value={form.identifier} onChange={set("identifier")} placeholder="9876543210 or farmer@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </button>
            <div className="form-divider">or</div>
            <button type="button" className="btn btn-secondary btn-full" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }} onClick={guestLogin}>
              <UserIcon size={16} color="currentColor" /> Continue as Guest Farmer
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={set("name")} placeholder="Ramesh Patil" required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number or Email</label>
              <input className="form-input" value={form.identifier} onChange={set("identifier")} placeholder="9876543210" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password (min 6 characters)</label>
              <input className="form-input" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" minLength={6} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District</label>
                <input className="form-input" value={form.district} onChange={set("district")} placeholder="Nashik" />
              </div>
              <div className="form-group">
                <label className="form-label">Village</label>
                <input className="form-input" value={form.village} onChange={set("village")} placeholder="Pimpalgaon" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={set("role")}>
                <option value="farmer">Farmer</option>
                <option value="officer">Agriculture Officer</option>
                <option value="expert">Agronomist / Expert</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}

        {msg.text && <div className={`form-msg ${msg.type}`}>{msg.text}</div>}
      </div>
    </div>
  );
}
