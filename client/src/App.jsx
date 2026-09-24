import { useState, useEffect } from "react";
import AuthPage    from "./components/AuthPage";
import DiseaseTab  from "./components/DiseaseTab";
import PestTab     from "./components/PestTab";
import ForecastTab from "./components/ForecastTab";
import HistoryTab  from "./components/HistoryTab";

const NAV_ITEMS = [
  { id: "disease",  label: "Disease Detection", icon: "🌿", badge: "AI Vision" },
  { id: "pest",     label: "Pest Monitor",      icon: "🦗", badge: "ETL Limits" },
  { id: "forecast", label: "Risk Forecast",     icon: "🔮", badge: "XGBoost" },
  { id: "history",  label: "Scan History",      icon: "📜", badge: null },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("disease");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check saved session on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("agri_user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.warn("Could not parse saved user:", e);
    }
  }, []);

  function handleLogin(u) {
    setUser(u);
    try {
      localStorage.setItem("agri_user", JSON.stringify(u));
    } catch (e) {
      console.warn("Could not save user session:", e);
    }
  }

  function handleLogout() {
    localStorage.removeItem("agri_token");
    localStorage.removeItem("agri_user");
    setUser(null);
  }

  if (!user) return <AuthPage onLogin={handleLogin} />;

  const activeItem = NAV_ITEMS.find((n) => n.id === tab) || NAV_ITEMS[0];

  return (
    <div className="app-shell">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="logo-icon">🌱</div>
            <div className="brand-text">
              <h1>Agri-<span>AI</span></h1>
              <p>Smart Agro Advisor</p>
            </div>
          </div>
          {mobileMenuOpen && (
            <button
              className="mini-btn"
              onClick={() => setMobileMenuOpen(false)}
              style={{ padding: "0.2rem 0.5rem" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <div className="sidebar-heading">Navigation Menu</div>
          {NAV_ITEMS.map((item) => {
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-link ${isActive ? "active" : ""}`}
                onClick={() => {
                  setTab(item.id);
                  setMobileMenuOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && <span className="sidebar-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {/* AI Neural Engine Status */}
          <div className="sidebar-status-pill">
            <span className="pulse-dot" />
            <span>AI Neural Engine Active</span>
          </div>

          {/* Google Translate Widget Container */}
          <div className="translate-box">
            <div id="google_translate_element" />
          </div>

          {/* User Profile & Logout */}
          <div className="user-profile-card">
            <div className="user-avatar">👨‍🌾</div>
            <div className="user-meta">
              <div className="user-name">{user.name || "Guest Farmer"}</div>
              <div className="user-role">
                {user.role === "officer" ? "🏛️ Agri Officer" : user.role === "expert" ? "🔬 Agronomist" : "🌾 Farmer"}
                {user.district ? ` · ${user.district}` : ""}
              </div>
            </div>
            <button
              className="btn-logout"
              onClick={handleLogout}
              title="Logout from Agri-AI"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="main-viewport">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
            >
              ☰
            </button>
            <div className="page-title">
              <span>{activeItem.icon}</span>
              <span>{activeItem.label}</span>
            </div>
          </div>

          <div className="header-right">
            <span className="text-muted" style={{ fontSize: "0.82rem" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
            </span>
          </div>
        </header>

        {/* Content Container */}
        <main className="content-container">
          {tab === "disease"  && <DiseaseTab  user={user} />}
          {tab === "pest"     && <PestTab />}
          {tab === "forecast" && <ForecastTab />}
          {tab === "history"  && <HistoryTab  user={user} />}
        </main>
      </div>
    </div>
  );
}
