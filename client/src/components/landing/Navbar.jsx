import React, { useState, useEffect } from "react";
import { LeafIcon, MenuIcon, CloseIcon, ArrowRightIcon, UserIcon } from "../Icons";

export default function Navbar({ onLogin, onGetStarted, user, onGoToApp }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Home", href: "#hero" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "Risk Monitoring", href: "#risk-monitoring" },
    { label: "About", href: "#about" }
  ];

  const handleLinkClick = (e, href) => {
    e.preventDefault();
    setMobileOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className={`landing-navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="landing-container">
        <div className="nav-inner">
          {/* Logo & Brand */}
          <a href="#hero" onClick={(e) => handleLinkClick(e, "#hero")} className="nav-brand">
            <div className="nav-brand-icon">
              <LeafIcon size={20} color="#ffffff" />
            </div>
            <span>Agri-AI</span>
          </a>

          {/* Desktop Navigation Links */}
          <ul className="nav-links">
            {navLinks.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  onClick={(e) => handleLinkClick(e, item.href)}
                  className="nav-link"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Action CTAs */}
          <div className="nav-actions">
            <button
              type="button"
              onClick={onLogin}
              className="agri-btn agri-btn-ghost"
              id="nav-btn-login"
              style={{
                border: "1.5px solid var(--agri-primary)",
                color: "var(--agri-primary)",
                fontWeight: 700
              }}
            >
              <UserIcon size={15} />
              <span>{user && !user.guest ? `Account (${user.name?.split(" ")[0] || "User"})` : "Login"}</span>
            </button>

            <button
              type="button"
              onClick={user ? onGoToApp : onGetStarted}
              className="agri-btn agri-btn-primary"
              id="nav-btn-get-started"
            >
              <span>{user ? "Open Dashboard" : "Get Started"}</span>
              <ArrowRightIcon size={15} />
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="nav-hamburger"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="mobile-menu-drawer open">
          {navLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => handleLinkClick(e, item.href)}
              className="nav-link"
              style={{ padding: "0.5rem 0", fontSize: "1.05rem" }}
            >
              {item.label}
            </a>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => { setMobileOpen(false); onLogin(); }}
              className="agri-btn agri-btn-secondary"
              id="nav-mobile-btn-login"
            >
              <UserIcon size={16} />
              <span>{user && !user.guest ? `Account (${user.name})` : "Login"}</span>
            </button>
            <button
              type="button"
              onClick={() => { setMobileOpen(false); if (user) onGoToApp(); else onGetStarted(); }}
              className="agri-btn agri-btn-primary"
              id="nav-mobile-btn-getstarted"
            >
              <span>{user ? "Open Dashboard" : "Get Started"}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
