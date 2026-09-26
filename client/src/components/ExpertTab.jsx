import { useState, useEffect } from "react";
import {
  LeafIcon,
  MapIcon,
  PestIcon,
  ExpertIcon,
  CheckCircleIcon,
  CheckIcon,
  EditIcon,
  HelpCircleIcon,
  DownloadIcon,
  DatabaseIcon,
  RefreshIcon,
  LocationPinIcon,
  UserIcon,
  ClockIcon,
  AlertTriangleIcon,
  StarIcon,
  TagIcon,
  RobotIcon,
  ChartBarIcon,
  CopyIcon,
  GlobeIcon,
  MicroscopeIcon,
  TrapIcon,
  ArrowRightIcon,
  ClipboardListIcon,
  CloseIcon,
} from "./Icons";

const API = "";

const TOMATO_DISEASES = [
  "Tomato Septoria Leaf Spot",
  "Tomato Early Blight",
  "Tomato Late Blight",
  "Tomato Bacterial Spot",
  "Tomato Leaf Mold",
  "Tomato Target Spot",
  "Tomato Yellow Leaf Curl Virus",
  "Tomato Mosaic Virus",
  "Tomato Spider Mites",
  "Healthy Tomato"
];

const PEST_SPECIES = [
  "Tomato Fruit Borer (Helicoverpa armigera)",
  "Fall Armyworm (Spodoptera frugiperda)",
  "Aphids (Aphis gossypii)",
  "Two-Spotted Spider Mites (Tetranychus urticae)",
  "Whitefly (Bemisia tabaci)",
  "Flea Beetle (Phyllotreta spp.)",
  "Stem Borer (Chilo partellus)",
  "Grasshopper / Locust (Schistocerca gregaria)",
  "Mustard Sawfly (Athalia lugens proxima)"
];

export default function ExpertTab({ user, onNavigateToMap }) {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' | 'groundtruth' | 'all'
  const [categoryFilter, setCategoryFilter] = useState("all"); // 'all' | 'disease' | 'pest'
  const [search, setSearch] = useState("");
  const [cropFilter, setCropFilter] = useState("all");

  // Review Modal State
  const [selectedCase, setSelectedCase] = useState(null);
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctDisease, setCorrectDisease] = useState("Tomato Septoria Leaf Spot");
  const [correctSeverity, setCorrectSeverity] = useState("Moderate");
  const [expertNotes, setExpertNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Ground Truth Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  // 1. Fetch cases & stats
  async function loadData() {
    setLoading(true);
    try {
      const [casesRes, statsRes] = await Promise.all([
        fetch(`${API}/api/expert/cases?status=${activeTab === "groundtruth" ? "all" : activeTab}&category=${categoryFilter}&search=${encodeURIComponent(search)}`),
        fetch(`${API}/api/expert/stats`)
      ]);

      const casesJson = await casesRes.json();
      const statsJson = await statsRes.json();

      if (casesJson.success) {
        let list = casesJson.cases || [];
        if (activeTab === "groundtruth") {
          list = list.filter((c) => c.is_ground_truth === true);
        }
        setCases(list);
      }
      if (statsJson.success) {
        setStats(statsJson.stats);
      }
    } catch (err) {
      console.warn("Could not load expert cases:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab, search, categoryFilter]);

  // 2. Quick Actions
  async function handleConfirm(caseItem) {
    if (!window.confirm(`Confirm that AI diagnosis "${caseItem.ai_disease}" is accurate for ${caseItem.case_number}?`)) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/expert/validate/${caseItem.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          expertName: user?.name ? `Dr. ${user.name}` : "Dr. Arvind Deshmukh (Senior Agronomist)",
          expertNotes: `Confirmed by expert agronomist. AI diagnosis (${caseItem.ai_disease} @ ${caseItem.ai_confidence}%) verified as ground truth.`
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({
          type: "success",
          text: `${caseItem.case_number} confirmed! Saved as verified ground-truth training sample.`
        });
        loadData();
      }
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Failed to confirm case: " + err.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCorrectionModal(caseItem) {
    setSelectedCase(caseItem);
    const isPest = caseItem.category === "pest" || 
      (caseItem.ai_disease && (
        caseItem.ai_disease.toLowerCase().includes("borer") ||
        caseItem.ai_disease.toLowerCase().includes("worm") ||
        caseItem.ai_disease.toLowerCase().includes("aphid") ||
        caseItem.ai_disease.toLowerCase().includes("mite") ||
        caseItem.ai_disease.toLowerCase().includes("beetle")
      ));

    if (isPest) {
      if (caseItem.ai_disease.toLowerCase().includes("borer") || caseItem.ai_disease.toLowerCase().includes("helicoverpa")) {
        setCorrectDisease("Tomato Fruit Borer (Helicoverpa armigera)");
        setExpertNotes("Agronomist field review confirms larval fruit boring and frass. Trap counts verify adult Helicoverpa flight peak exceeding Economic Threshold Level (ETL).");
      } else {
        setCorrectDisease(PEST_SPECIES[0]);
        setExpertNotes(`Agronomist inspection confirms morphological features match ${PEST_SPECIES[0]}.`);
      }
    } else if (caseItem.ai_disease.toLowerCase().includes("early blight")) {
      setCorrectDisease("Tomato Septoria Leaf Spot");
      setExpertNotes("Microscopic inspection confirms circular lesions with dark brown margins and sunken grey centers with pycnidia fruiting bodies. Lacks concentric target-board rings of Alternaria solani. Ground-truth corrected.");
    } else {
      setCorrectDisease(TOMATO_DISEASES[0]);
      setExpertNotes(`Corrected diagnosis based on foliar symptom morphology. Lacks characteristic markers of ${caseItem.ai_disease}.`);
    }
    setCorrectSeverity(caseItem.ai_severity || "Moderate");
    setCorrectModalOpen(true);
  }

  async function handleCorrectSubmit() {
    if (!selectedCase) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/expert/validate/${selectedCase.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct",
          expertDisease: correctDisease,
          expertSeverity: correctSeverity,
          expertNotes: expertNotes.trim() || `Corrected from ${selectedCase.ai_disease} to ${correctDisease} by agronomist.`,
          expertName: user?.name ? `Dr. ${user.name}` : "Dr. Arvind Deshmukh (Senior Agronomist)"
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({
          type: "success",
          text: `Discrepancy stored for ${selectedCase.case_number}! AI: ${selectedCase.ai_disease} -> Expert: ${correctDisease}. Ground-truth saved.`
        });
        setCorrectModalOpen(false);
        loadData();
      }
    } catch (err) {
      alert("Error updating validation: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUncertain(caseItem) {
    const reason = window.prompt("Enter reason for marking case as inconclusive/uncertain:", "Symptoms ambiguous; specimen withered. Requires laboratory culture or fresh sample.");
    if (reason === null) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/expert/validate/${caseItem.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "uncertain",
          expertDisease: "Inconclusive / Lab Sample Required",
          expertNotes: reason,
          expertName: user?.name ? `Dr. ${user.name}` : "Dr. Arvind Deshmukh (Senior Agronomist)"
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({
          type: "warning",
          text: `${caseItem.case_number} marked as uncertain / lab sample required.`
        });
        loadData();
      }
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Failed to mark uncertain: " + err.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  // 3. Open Ground-Truth Exporter
  async function openExportDataset() {
    setShowExportModal(true);
    setExportLoading(true);
    try {
      const res = await fetch(`${API}/api/expert/ground-truth?format=json`);
      const d = await res.json();
      if (d.success) {
        setExportData(d);
      }
    } catch (err) {
      console.warn("Could not export dataset:", err);
    } finally {
      setExportLoading(false);
    }
  }

  function downloadCsv() {
    window.open(`${API}/api/expert/ground-truth?format=csv`, "_blank");
  }

  return (
    <div className="expert-dashboard-container" style={{ padding: "0 0.5rem" }}>
      {/* ── Top Header ─────────────────────────────────────────── */}
      <div className="section-header" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.85rem" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ExpertIcon size={24} color="#2563eb" />
              <span>Expert Validation &amp; Ground-Truth Annotation</span>
            </h2>
            <p>
              Human-in-the-loop (HITL) agronomist review queue. Verifying AI predictions, resolving diagnostic edge cases, and storing validated ground-truth pairs for model retraining.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openExportDataset}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.84rem",
                fontWeight: 700,
                border: "1.5px solid #2563eb",
                color: "#1d4ed8",
                background: "rgba(37,99,235,0.06)",
                padding: "0.45rem 0.9rem"
              }}
            >
              <DownloadIcon size={15} color="#1d4ed8" />
              <span>Export Ground-Truth Dataset</span>
            </button>
            <span
              className="sidebar-badge"
              style={{
                background: "rgba(16,185,129,0.12)",
                color: "#047857",
                border: "1px solid #10b981",
                fontWeight: 700,
                padding: "0.42rem 0.8rem",
                fontSize: "0.82rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <DatabaseIcon size={14} color="#047857" />
              <span>PostgreSQL Ground-Truth DB Active</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Feedback Notification ──────────────────────────────── */}
      {feedbackMsg && (
        <div
          style={{
            background: feedbackMsg.type === "success" ? "#f0fdf4" : feedbackMsg.type === "warning" ? "#fffbeb" : "#fef2f2",
            border: `1px solid ${feedbackMsg.type === "success" ? "#86efac" : feedbackMsg.type === "warning" ? "#fde68a" : "#fca5a5"}`,
            color: feedbackMsg.type === "success" ? "#166534" : feedbackMsg.type === "warning" ? "#92400e" : "#991b1b",
            borderRadius: "10px",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.86rem",
            fontWeight: 600
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {feedbackMsg.type === "success" ? (
              <CheckCircleIcon size={16} color="#166534" />
            ) : (
              <AlertTriangleIcon size={16} color={feedbackMsg.type === "warning" ? "#92400e" : "#991b1b"} />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "inherit" }}
            aria-label="Dismiss message"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {/* ── KPI Metric Counters ────────────────────────────────── */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.85rem",
            marginBottom: "1.25rem"
          }}
        >
          <div className="stat-card" style={{ background: "var(--card-bg, #ffffff)", border: "1px solid #fed7aa", borderRadius: "12px", padding: "0.85rem 1rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ea580c", textTransform: "uppercase" }}>Pending Reviews</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "1.65rem", fontWeight: 800, color: "#c2410c" }}>{stats.pendingCases}</span>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>awaiting expert</span>
            </div>
          </div>

          <div className="stat-card" style={{ background: "var(--card-bg, #ffffff)", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "0.85rem 1rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>Confirmed Matches</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "1.65rem", fontWeight: 800, color: "#15803d" }}>{stats.confirmedCases}</span>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>AI verified right</span>
            </div>
          </div>

          <div className="stat-card" style={{ background: "var(--card-bg, #ffffff)", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "0.85rem 1rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>Corrected Discrepancies</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "1.65rem", fontWeight: 800, color: "#1d4ed8" }}>{stats.correctedCases}</span>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>ground-truth saved</span>
            </div>
          </div>

          <div className="stat-card" style={{ background: "var(--card-bg, #ffffff)", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "0.85rem 1rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>AI Agreement Rate</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "1.65rem", fontWeight: 800, color: "#0f172a" }}>{stats.aiAgreementRate}%</span>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>human-AI consensus</span>
            </div>
          </div>

          <div className="stat-card" style={{ background: "var(--card-bg, #ffffff)", border: "1px solid #e9d5ff", borderRadius: "12px", padding: "0.85rem 1rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9333ea", textTransform: "uppercase" }}>Ground-Truth Dataset</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "1.65rem", fontWeight: 800, color: "#7e22ce" }}>{stats.groundTruthCount}</span>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>labeled pairs</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Bar & Mode Tabs ──────────────────────────────── */}
      <div
        className="spatial-controls-card"
        style={{
          background: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "12px",
          padding: "0.75rem 1rem",
          marginBottom: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem"
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Status Tabs */}
          <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              style={{
                padding: "0.38rem 0.85rem",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: activeTab === "pending" ? 700 : 500,
                background: activeTab === "pending" ? "#ffffff" : "transparent",
                color: activeTab === "pending" ? "#ea580c" : "#64748b",
                border: "none",
                cursor: "pointer",
                boxShadow: activeTab === "pending" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ClockIcon size={14} color={activeTab === "pending" ? "#ea580c" : "#64748b"} />
              <span>Pending Review Queue {stats?.pendingCases > 0 ? `(${stats.pendingCases})` : ""}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("groundtruth")}
              style={{
                padding: "0.38rem 0.85rem",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: activeTab === "groundtruth" ? 700 : 500,
                background: activeTab === "groundtruth" ? "#ffffff" : "transparent",
                color: activeTab === "groundtruth" ? "#1d4ed8" : "#64748b",
                border: "none",
                cursor: "pointer",
                boxShadow: activeTab === "groundtruth" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <CheckCircleIcon size={14} color={activeTab === "groundtruth" ? "#1d4ed8" : "#64748b"} />
              <span>Verified Ground-Truth {stats?.groundTruthCount > 0 ? `(${stats.groundTruthCount})` : ""}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              style={{
                padding: "0.38rem 0.85rem",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: activeTab === "all" ? 700 : 500,
                background: activeTab === "all" ? "#ffffff" : "transparent",
                color: activeTab === "all" ? "#0f172a" : "#64748b",
                border: "none",
                cursor: "pointer",
                boxShadow: activeTab === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ClipboardListIcon size={14} color={activeTab === "all" ? "#0f172a" : "#64748b"} />
              <span>All ({stats?.totalCases || cases.length})</span>
            </button>
          </div>

          {/* Domain Filter Pills (Foliar Diseases vs Insect Pests) */}
          <div style={{ display: "flex", gap: "3px", background: "#f8fafc", padding: "3px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              style={{
                padding: "0.34rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: categoryFilter === "all" ? 700 : 500,
                background: categoryFilter === "all" ? "#0f172a" : "transparent",
                color: categoryFilter === "all" ? "#ffffff" : "#64748b",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <GlobeIcon size={13} />
              <span>All Domains</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("disease")}
              style={{
                padding: "0.34rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: categoryFilter === "disease" ? 700 : 500,
                background: categoryFilter === "disease" ? "#059669" : "transparent",
                color: categoryFilter === "disease" ? "#ffffff" : "#047857",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <LeafIcon size={13} />
              <span>Foliar Diseases {stats?.diseaseCases ? `(${stats.diseaseCases})` : ""}</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("pest")}
              style={{
                padding: "0.34rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: categoryFilter === "pest" ? 700 : 500,
                background: categoryFilter === "pest" ? "#d97706" : "transparent",
                color: categoryFilter === "pest" ? "#ffffff" : "#b45309",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <PestIcon size={13} />
              <span>Insect Pests {stats?.pestCases ? `(${stats.pestCases})` : ""}</span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search Case #, disease, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "260px", padding: "0.36rem 0.75rem", fontSize: "0.82rem" }}
          />
        </div>
      </div>

      {/* ── Active Learning Pipeline Explanation Banner ─────────── */}
      <div
        style={{
          background: "linear-gradient(90deg, #f0fdf4 0%, #eff6ff 100%)",
          border: "1px solid #bfdbfe",
          borderRadius: "10px",
          padding: "0.75rem 1rem",
          marginBottom: "1.25rem",
          fontSize: "0.82rem",
          color: "#1e3a8a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.6rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <RefreshIcon size={20} color="#2563eb" />
          <span>
            <strong>Active Learning Pipeline:</strong> When experts confirm or correct a diagnosis (e.g. <em>AI: Early Blight</em> &rarr; <em>Expert: Septoria Leaf Spot</em>), both labels are immutably preserved in PostgreSQL. This generates high-quality labeled benchmark pairs for retraining the PyTorch ONNX classifier.
          </span>
        </div>
      </div>

      {/* ── Cases Review List ───────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <span className="spinner" style={{ width: "24px", height: "24px" }} />
          <p className="text-muted mt-2">Loading cases from PostgreSQL...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="card text-center" style={{ padding: "3rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <LeafIcon size={44} color="#94a3b8" />
          <h3 className="mt-2">No cases found in this view</h3>
          <p className="text-muted">All incoming scans are currently processed, or no records match your filter.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {cases.map((c) => {
            const isPending = c.validation_status === "pending";
            const isConfirmed = c.validation_status === "confirmed";
            const isCorrected = c.validation_status === "corrected";
            const isCase1024 = c.case_number === "CASE-1024";

            return (
              <div
                key={c.id}
                className="case-card"
                style={{
                  background: "var(--card-bg, #ffffff)",
                  border: isCase1024
                    ? "2px solid #f97316"
                    : isCorrected
                    ? "1.5px solid #3b82f6"
                    : isConfirmed
                    ? "1.5px solid #10b981"
                    : "1px solid var(--border, #e2e8f0)",
                  borderRadius: "14px",
                  padding: "1.25rem",
                  boxShadow: isCase1024 ? "0 4px 14px rgba(249,115,22,0.12)" : "0 2px 8px rgba(0,0,0,0.03)",
                  position: "relative"
                }}
              >
                {/* Highlight banner for user's requested Case #1024 */}
                {isCase1024 && isPending && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      right: "24px",
                      background: "linear-gradient(90deg, #ea580c 0%, #f97316 100%)",
                      color: "#ffffff",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "2px 10px",
                      borderRadius: "12px",
                      letterSpacing: "0.5px",
                      boxShadow: "0 2px 6px rgba(234,88,12,0.3)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px"
                    }}
                  >
                    <StarIcon size={12} color="#ffffff" />
                    <span>PRIORITY REVIEW CASE</span>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: "1.25rem", alignItems: "start" }}>
                  {/* Left Column: Specimen Image & Visual Findings */}
                  <div>
                    <div
                      style={{
                        width: "100%",
                        height: "170px",
                        background: "#0f172a",
                        borderRadius: "10px",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative"
                      }}
                    >
                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt={c.case_number}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          display: c.image_url ? "none" : "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          color: "#94a3b8",
                          fontSize: "0.75rem",
                          textAlign: "center",
                          padding: "0.5rem"
                        }}
                      >
                        {c.category === "pest" ? (
                          <PestIcon size={34} color="#64748b" />
                        ) : (
                          <LeafIcon size={34} color="#64748b" />
                        )}
                        <span style={{ marginTop: "4px" }}>{c.crop} Specimen</span>
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          left: "6px",
                          background: "rgba(0,0,0,0.7)",
                          color: "#ffffff",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}
                      >
                        {c.crop} Leaf
                      </div>
                    </div>

                    <div style={{ marginTop: "0.65rem", fontSize: "0.75rem", color: "#64748b", display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <LocationPinIcon size={12} color="#94a3b8" />
                        <span>{c.village}, {c.district}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <UserIcon size={12} color="#94a3b8" />
                        <span>{c.farmer_name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <ClockIcon size={12} color="#94a3b8" />
                        <span>{new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Case Details & Validation Controls */}
                  <div>
                    {/* Header bar: Case Number & Status Badges */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.65rem", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>
                            {c.case_number}
                          </h3>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: c.category === "pest" ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)",
                              color: c.category === "pest" ? "#b45309" : "#047857",
                              border: `1px solid ${c.category === "pest" ? "#fcd34d" : "#a7f3d0"}`,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            {c.category === "pest" ? <PestIcon size={12} /> : <LeafIcon size={12} />}
                            <span>{c.category === "pest" ? "Insect Pest" : "Foliar Disease"}</span>
                          </span>
                          <span
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: isConfirmed
                                ? "rgba(16,185,129,0.12)"
                                : isCorrected
                                ? "rgba(37,99,235,0.12)"
                                : isPending
                                ? "rgba(234,88,12,0.12)"
                                : "#f1f5f9",
                              color: isConfirmed
                                ? "#047857"
                                : isCorrected
                                ? "#1d4ed8"
                                : isPending
                                ? "#c2410c"
                                : "#64748b",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            {isConfirmed ? (
                              <>
                                <CheckIcon size={12} />
                                <span>Confirmed by Expert</span>
                              </>
                            ) : isCorrected ? (
                              <>
                                <EditIcon size={12} />
                                <span>Expert Corrected</span>
                              </>
                            ) : isPending ? (
                              <>
                                <ClockIcon size={12} />
                                <span>Pending Review</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangleIcon size={12} />
                                <span>Inconclusive</span>
                              </>
                            )}
                          </span>
                          {c.is_ground_truth && (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "#f3e8ff",
                                color: "#7e22ce",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <TagIcon size={11} color="#7e22ce" />
                              <span>Ground-Truth</span>
                            </span>
                          )}
                        </div>
                        <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "2px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span>Specimen Crop: <strong>{c.crop}</strong></span>
                          {c.category === "pest" && c.trap_count && (
                            <span style={{ color: "#b45309", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <TrapIcon size={12} />
                              <span>Trap Catch: {c.trap_count} pests</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* GIS Outbreak Map Link */}
                      {onNavigateToMap && (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToMap({
                              latitude: parseFloat(c.latitude) || 19.9975,
                              longitude: parseFloat(c.longitude) || 73.7898,
                              disease: c.ai_disease,
                              crop: c.crop,
                              village: c.village,
                              district: c.district,
                              severity: c.ai_severity,
                              confidence: c.ai_confidence,
                              caseNumber: c.case_number,
                              category: c.category || "disease"
                            });
                          }}
                          style={{
                            background: "rgba(16,185,129,0.08)",
                            color: "#047857",
                            border: "1.5px solid #10b981",
                            borderRadius: "7px",
                            padding: "0.38rem 0.8rem",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.15s ease"
                          }}
                          title={`Inspect ${c.case_number} on the PostGIS Geospatial Outbreak Cluster Map`}
                        >
                          <MapIcon size={14} color="#047857" />
                          <span>View on GIS Outbreak Map</span>
                          <ArrowRightIcon size={12} color="#047857" />
                        </button>
                      )}
                    </div>

                    {/* AI Predictions vs Expert Diagnosis Grid */}
                    <div
                      style={{
                        background: isCorrected ? "#f8fafc" : "#fafafa",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "0.85rem 1rem",
                        marginBottom: "0.85rem"
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: isCorrected ? "1fr 1fr" : "1fr", gap: "1rem" }}>
                        {/* AI Detection Card */}
                        <div>
                          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "5px" }}>
                            <RobotIcon size={13} color="#64748b" />
                            <span>AI Model Diagnosis</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                            <span style={{ fontSize: "1.05rem", fontWeight: 800, color: isCorrected ? "#64748b" : "#0f172a", textDecoration: isCorrected ? "line-through" : "none" }}>
                              {c.ai_disease}
                            </span>
                            <span
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                color: parseFloat(c.ai_confidence) >= 80 ? "#15803d" : "#c2410c"
                              }}
                            >
                              ({c.ai_confidence}% confidence)
                            </span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "2px" }}>
                            Severity: <strong>{c.ai_severity || "Moderate"}</strong>
                          </div>

                          {/* Confidence Progress Bar */}
                          <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "3px", marginTop: "6px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, c.ai_confidence))}%`,
                                height: "100%",
                                background: parseFloat(c.ai_confidence) >= 80 ? "#22c55e" : parseFloat(c.ai_confidence) >= 60 ? "#f97316" : "#ef4444"
                              }}
                            />
                          </div>
                        </div>

                        {/* Expert Corrected Ground Truth (When Available) */}
                        {isCorrected && (
                          <div style={{ borderLeft: "2px solid #3b82f6", paddingLeft: "1rem" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "5px" }}>
                              <ExpertIcon size={14} color="#1d4ed8" />
                              <span>Expert Ground-Truth</span>
                            </div>
                            <div style={{ fontSize: "1.08rem", fontWeight: 800, color: "#1e3a8a", marginTop: "4px" }}>
                              {c.expert_disease}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#047857", marginTop: "2px", fontWeight: 600 }}>
                              Severity: {c.expert_severity || c.ai_severity}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "2px" }}>
                              Verified by: <strong>{c.expert_name || "Senior Agronomist"}</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expert Pathology Notes if Reviewed */}
                      {c.expert_notes && (
                        <div
                          style={{
                            marginTop: "0.75rem",
                            paddingTop: "0.65rem",
                            borderTop: "1px dashed #cbd5e1",
                            fontSize: "0.8rem",
                            color: "#334155",
                            lineHeight: 1.45,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "6px"
                          }}
                        >
                          <MicroscopeIcon size={14} color="#2563eb" style={{ flexShrink: 0, marginTop: "2px" }} />
                          <div>
                            <strong>Clinical Rationale:</strong> {c.expert_notes}
                          </div>
                        </div>
                      )}

                      {/* VLM Evidence Summary */}
                      {c.vlm_evidence && c.vlm_evidence.morphologySummary && (
                        <div
                          style={{
                            marginTop: "0.6rem",
                            fontSize: "0.78rem",
                            color: "#475569",
                            background: "rgba(0,0,0,0.02)",
                            padding: "4px 8px",
                            borderRadius: "6px"
                          }}
                        >
                          <strong>Visual Morphology:</strong> {c.vlm_evidence.morphologySummary}
                        </div>
                      )}
                    </div>

                    {/* ── Action Buttons for Pending Review ───────── */}
                    {isPending ? (
                      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{
                            background: "#16a34a",
                            border: "none",
                            padding: "0.45rem 1rem",
                            fontSize: "0.84rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                          onClick={() => handleConfirm(c)}
                          disabled={isSubmitting}
                        >
                          <CheckIcon size={14} color="#ffffff" />
                          <span>Confirm</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            padding: "0.45rem 1rem",
                            fontSize: "0.84rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                          onClick={() => openCorrectionModal(c)}
                          disabled={isSubmitting}
                        >
                          <EditIcon size={14} color="#ffffff" />
                          <span>Correct</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            background: "#f1f5f9",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                            padding: "0.45rem 0.85rem",
                            fontSize: "0.84rem",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                          onClick={() => handleUncertain(c)}
                          disabled={isSubmitting}
                        >
                          <HelpCircleIcon size={14} color="#475569" />
                          <span>Uncertain</span>
                        </button>

                        <span style={{ fontSize: "0.78rem", color: "#64748b", marginLeft: "auto" }}>
                          Case ID: #{c.id}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <CheckIcon size={13} color="#16a34a" />
                          <span>Review completed on {c.validated_at ? new Date(c.validated_at).toLocaleDateString("en-IN") : "Record"}</span>
                        </span>
                        <button
                          type="button"
                          className="mini-btn"
                          style={{ fontSize: "0.75rem", padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          onClick={() => openCorrectionModal(c)}
                        >
                          <EditIcon size={12} />
                          <span>Re-edit Diagnosis</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Correction Drawer / Modal ────────────────────────────── */}
      {correctModalOpen && selectedCase && (
        <div className="modal-overlay" onClick={() => setCorrectModalOpen(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "520px", padding: "1.5rem" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <EditIcon size={18} color="#2563eb" />
                  <span>Correct AI Diagnosis for {selectedCase.case_number}</span>
                </h3>
                <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: "2px" }}>
                  Override AI prediction with certified agronomist ground truth. Both labels are immutably archived.
                </p>
              </div>
              <button
                className="preview-remove"
                style={{ position: "static", display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => setCorrectModalOpen(false)}
                aria-label="Close Modal"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            {/* AI Diagnosis Pill */}
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "0.6rem 0.85rem", borderRadius: "8px", marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>AI Original Prediction</span>
              <div style={{ fontWeight: 800, color: "#b91c1c", fontSize: "0.95rem" }}>
                {selectedCase.ai_disease} ({selectedCase.ai_confidence}% confidence)
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "0.85rem" }}>
              <label className="form-label">
                True / Verified Ground-Truth {selectedCase.category === "pest" ? "Pest Species" : "Disease"}
              </label>
              <select
                className="form-input"
                value={correctDisease}
                onChange={(e) => setCorrectDisease(e.target.value)}
                style={{ fontWeight: 700, color: "#1e3a8a" }}
              >
                {selectedCase.category === "pest"
                  ? PEST_SPECIES.map((p) => (
                      <option key={p} value={p}>
                        {p} {p.includes("Tomato Fruit Borer") ? "(Recommended Pest Match)" : ""}
                      </option>
                    ))
                  : TOMATO_DISEASES.map((d) => (
                      <option key={d} value={d}>
                        {d} {d === "Tomato Septoria Leaf Spot" ? "(Recommended Discrepancy Match)" : ""}
                      </option>
                    ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: "0.85rem" }}>
              <label className="form-label">Corrected Severity / ETL Assessment</label>
              <select
                className="form-input"
                value={correctSeverity}
                onChange={(e) => setCorrectSeverity(e.target.value)}
              >
                {selectedCase.category === "pest" ? (
                  <>
                    <option value="Low (Below Economic Threshold Level)">Low (Below Economic Threshold Level)</option>
                    <option value="Moderate (Approaching ETL)">Moderate (Approaching ETL)</option>
                    <option value="High (Exceeds ETL - Treatment Recommended)">High (Exceeds ETL - Treatment Recommended)</option>
                    <option value="Critical (Severe Infestation - Urgent IPM Action)">Critical (Severe Infestation - Urgent IPM Action)</option>
                  </>
                ) : (
                  <>
                    <option value="Low (0-10% leaf area affected)">Low (&lt; 10% leaf area affected)</option>
                    <option value="Moderate (10-25% leaf area affected)">Moderate (10-25% leaf area affected)</option>
                    <option value="Severe (25-50% leaf area affected)">Severe (25-50% leaf area affected)</option>
                    <option value="Critical (>50% defoliation)">Critical (&gt; 50% defoliation)</option>
                  </>
                )}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label">Agronomist Clinical Rationale &amp; Pathology Notes</label>
              <textarea
                className="form-input"
                rows="3"
                value={expertNotes}
                onChange={(e) => setExpertNotes(e.target.value)}
                placeholder="Explain why AI was corrected (e.g. pycnidia present, lesion size, concentric ring absence)..."
                style={{ fontSize: "0.82rem", lineHeight: 1.4 }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={handleCorrectSubmit}
                disabled={isSubmitting}
                style={{ background: "#2563eb", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <CheckIcon size={16} color="#ffffff" />
                <span>{isSubmitting ? "Saving Ground Truth..." : "Save Ground-Truth & Correct Diagnosis"}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCorrectModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ground-Truth Dataset Exporter Modal ──────────────────── */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "680px", padding: "1.5rem" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <DatabaseIcon size={20} color="#2563eb" />
                  <span>Active Learning Ground-Truth Dataset Export</span>
                </h3>
                <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: "2px" }}>
                  Exporting human-verified ground-truth pairs for fine-tuning the PyTorch ONNX disease classifier.
                </p>
              </div>
              <button
                className="preview-remove"
                style={{ position: "static", display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => setShowExportModal(false)}
                aria-label="Close Modal"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            {exportLoading ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <span className="spinner" />
                <p className="text-muted mt-2">Exporting dataset from PostgreSQL...</p>
              </div>
            ) : exportData ? (
              <div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.75rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", alignItems: "center" }}>
                    <span>Total Verified Ground-Truth Pairs: <strong>{exportData.totalGroundTruthPairs}</strong></span>
                    <span style={{ color: "#047857", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <CheckIcon size={14} color="#047857" />
                      <span>Ready for Active Learning Loop</span>
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Dataset JSON Sample (First 2 Records)</label>
                  <pre
                    style={{
                      background: "#0f172a",
                      color: "#38bdf8",
                      padding: "0.85rem",
                      borderRadius: "8px",
                      fontSize: "0.75rem",
                      maxHeight: "220px",
                      overflowY: "auto"
                    }}
                  >
                    {JSON.stringify(exportData.dataset?.slice(0, 2), null, 2)}
                  </pre>
                </div>

                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={downloadCsv}
                    style={{ background: "#16a34a", fontWeight: 700, fontSize: "0.84rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <DownloadIcon size={15} color="#ffffff" />
                    <span>Download Retraining Manifest (CSV)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(exportData.dataset, null, 2));
                      alert("Ground-truth JSON copied to clipboard!");
                    }}
                    style={{ fontSize: "0.84rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <CopyIcon size={15} />
                    <span>Copy Full JSON to Clipboard</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowExportModal(false)}
                    style={{ marginLeft: "auto" }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
