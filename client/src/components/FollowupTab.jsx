import React, { useState, useEffect, useRef } from "react";
import {
  ClockIcon,
  CalendarIcon,
  RefreshIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  CheckCircleIcon,
  UploadCloudIcon,
  LeafIcon,
  UserIcon,
  SearchIcon,
  SparklesIcon,
  CloseIcon
} from "./Icons";

const API_BASE = "";

export default function FollowupTab({ user, initialCaseRef }) {
  const [cases, setCases] = useState([]);
  const [selectedCaseRef, setSelectedCaseRef] = useState(initialCaseRef || null);
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Follow-up submission modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [followupFile, setFollowupFile] = useState(null);
  const [followupPreview, setFollowupPreview] = useState(null);
  const [dayOffset, setDayOffset] = useState(5);
  const [treatmentFollowed, setTreatmentFollowed] = useState(true);
  const [fieldNotes, setFieldNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitError, setSubmitError] = useState("");

  const fileInputRef = useRef(null);

  // Sync initialCaseRef if passed from DiseaseTab
  useEffect(() => {
    if (initialCaseRef) {
      setSelectedCaseRef(initialCaseRef);
    }
  }, [initialCaseRef]);

  // Fetch all cases
  const loadCases = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/followup/cases`);
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
        if (data.cases?.length > 0 && !selectedCaseRef && !initialCaseRef) {
          setSelectedCaseRef(data.cases[0].case_ref);
        }
      } else {
        setCases([]);
      }
    } catch (err) {
      console.warn("Could not load followup cases (offline mode active):", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch single case timeline
  const loadCaseTimeline = async (caseRef) => {
    if (!caseRef) return;
    try {
      setLoadingTimeline(true);
      const res = await fetch(`${API_BASE}/api/followup/timeline/${caseRef}`);
      if (res.ok) {
        const data = await res.json();
        setTimelineData(data);
      }
    } catch (err) {
      console.warn("Could not load case timeline (offline mode):", err.message || err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    if (selectedCaseRef) {
      loadCaseTimeline(selectedCaseRef);
    }
  }, [selectedCaseRef]);

  // Handle file select
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFollowupFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setFollowupPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Submit follow-up inspection
  const handleSubmitFollowup = async (e) => {
    e.preventDefault();
    if (!followupFile) {
      setSubmitError("Please upload a foliage photo for comparison.");
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError("");
      const formData = new FormData();
      formData.append("image", followupFile);
      formData.append("caseRef", selectedCaseRef);
      formData.append("dayOffset", dayOffset);
      formData.append("notes", fieldNotes || `Inspection on Day ${dayOffset}`);
      formData.append("treatmentFollowed", treatmentFollowed);

      const res = await fetch(`${API_BASE}/api/followup/submit`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Inspection analysis failed.");
      }

      setSubmitResult(data);
      // Reload timeline and cases
      loadCaseTimeline(selectedCaseRef);
      loadCases();
    } catch (err) {
      setSubmitError(err.message || "Failed to submit follow-up inspection");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset modal
  const handleCloseModal = () => {
    setShowSubmitModal(false);
    setFollowupFile(null);
    setFollowupPreview(null);
    setFieldNotes("");
    setSubmitResult(null);
    setSubmitError("");
  };

  // Filter cases
  const filteredCases = cases.filter((c) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && (c.status === "scheduled" || c.status === "open")) ||
      (filter === "resolved" && c.status === "resolved");
    const matchesSearch =
      c.case_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.crop.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.initial_condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.farmer_name && c.farmer_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Calculate summary stats
  const totalCount = cases.length;
  const pendingCount = cases.filter((c) => c.status === "scheduled" || c.status === "open").length;
  const resolvedCount = cases.filter((c) => c.status === "resolved").length;

  return (
    <div className="followup-container" style={{ padding: "1.5rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* HEADER SECTION */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ color: "var(--green-mid, #16a34a)" }}>
              <ClockIcon size={24} />
            </span>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--text, #0f172a)" }}>
              Follow-up Monitoring & Recovery Tracking
            </h1>
          </div>
          <p style={{ color: "var(--text-secondary, #475569)", fontSize: "0.9rem" }}>
            Database-driven Day 1 vs Day 5 lesion delta comparison, treatment efficacy auditing, and milestone verification.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={loadCases}
            className="secondary-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "0.5rem 0.85rem",
              borderRadius: "var(--radius-sm, 8px)",
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--surface, #fff)",
              fontSize: "0.85rem",
              fontWeight: 500
            }}
          >
            <RefreshIcon size={15} />
            <span>Refresh Cases</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ background: "var(--surface, #fff)", padding: "1.2rem", borderRadius: "var(--radius, 12px)", border: "1px solid var(--border, #e2e8f0)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Total Cases Tracked</span>
            <LeafIcon size={18} color="var(--green-mid, #16a34a)" />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--text)", marginTop: "0.4rem" }}>{totalCount}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Logged from Vision Diagnostics</div>
        </div>

        <div style={{ background: "var(--surface, #fff)", padding: "1.2rem", borderRadius: "var(--radius, 12px)", border: "1px solid var(--border, #e2e8f0)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Scheduled / Active</span>
            <ClockIcon size={18} color="var(--orange, #f97316)" />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--orange, #f97316)", marginTop: "0.4rem" }}>{pendingCount}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Awaiting Day 5 image inspection</div>
        </div>

        <div style={{ background: "var(--surface, #fff)", padding: "1.2rem", borderRadius: "var(--radius, 12px)", border: "1px solid var(--border, #e2e8f0)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Inspection Complete</span>
            <CheckCircleIcon size={18} color="var(--green-mid, #16a34a)" />
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--green-mid, #16a34a)", marginTop: "0.4rem" }}>{resolvedCount}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Progression delta analyzed</div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1.5rem", alignItems: "start" }}>
        
        {/* LEFT COLUMN: CASE LIST */}
        <div style={{ background: "var(--surface, #fff)", borderRadius: "var(--radius, 12px)", border: "1px solid var(--border, #e2e8f0)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
              <input
                type="text"
                placeholder="Search case, crop, condition..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.65rem 0.45rem 2rem",
                  fontSize: "0.85rem",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: "1px solid var(--border, #e2e8f0)",
                  outline: "none"
                }}
              />
              <span style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <SearchIcon size={14} />
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.35rem" }}>
              {["all", "pending", "resolved"].map((tabKey) => (
                <button
                  key={tabKey}
                  onClick={() => setFilter(tabKey)}
                  style={{
                    flex: 1,
                    padding: "0.35rem 0.5rem",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    borderRadius: "6px",
                    border: "none",
                    background: filter === tabKey ? "var(--green-mid, #16a34a)" : "var(--border-soft, #f1f5f9)",
                    color: filter === tabKey ? "#fff" : "var(--text-secondary, #475569)",
                    textTransform: "capitalize"
                  }}
                >
                  {tabKey}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          <div style={{ maxHeight: "650px", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Loading cases from database...
              </div>
            ) : filteredCases.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                No crop cases found.
              </div>
            ) : (
              filteredCases.map((c) => {
                const isSelected = c.case_ref === selectedCaseRef;
                const isScheduled = c.status === "scheduled" || c.status === "open";
                return (
                  <div
                    key={c.case_ref}
                    onClick={() => setSelectedCaseRef(c.case_ref)}
                    style={{
                      padding: "0.9rem 1rem",
                      borderBottom: "1px solid var(--border-soft, #f1f5f9)",
                      cursor: "pointer",
                      background: isSelected ? "var(--green-light, #ecfdf5)" : "transparent",
                      borderLeft: isSelected ? "4px solid var(--green-mid, #16a34a)" : "4px solid transparent",
                      transition: "var(--transition)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>
                        {c.case_ref}
                      </span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          background: isScheduled ? "var(--orange-light, #fff7ed)" : "var(--green-light, #ecfdf5)",
                          color: isScheduled ? "var(--orange, #f97316)" : "var(--green-mid, #16a34a)"
                        }}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                      {c.crop} · {c.initial_condition}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      <span>Farmer: {c.farmer_name || "Self-scan"}</span>
                      <span>Next: {new Date(c.next_followup_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: TIMELINE & DAY 1 vs DAY 5 COMPARISON */}
        <div style={{ background: "var(--surface, #fff)", borderRadius: "var(--radius, 12px)", border: "1px solid var(--border, #e2e8f0)", padding: "1.5rem", boxShadow: "var(--shadow-sm)" }}>
          {loadingTimeline ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ display: "inline-block", animation: "spin 1s linear infinite", marginBottom: "0.5rem" }}>
                <RefreshIcon size={24} color="var(--green-mid, #16a34a)" />
              </div>
              <div>Retrieving database case records & progression timeline...</div>
            </div>
          ) : !timelineData ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-muted)" }}>
              Select a crop case from the left to view Day 1 vs Day 5 progression and follow-up timeline.
            </div>
          ) : (
            <div>
              {/* CASE HEADER INFO */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", borderBottom: "1px solid var(--border, #e2e8f0)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)" }}>
                      {timelineData.case.case_ref}
                    </span>
                    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, background: "var(--green-light)", color: "var(--green-mid)" }}>
                      {timelineData.case.crop}
                    </span>
                    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, background: "var(--border-soft)", color: "var(--text-secondary)" }}>
                      {timelineData.case.location_district || "Sangli"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Initial Diagnosis: <strong>{timelineData.case.initial_condition}</strong> ({timelineData.case.initial_severity_pct}% initial severity)
                  </div>
                </div>

                <button
                  onClick={() => setShowSubmitModal(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "0.6rem 1.1rem",
                    borderRadius: "var(--radius-sm, 8px)",
                    background: "var(--green-mid, #16a34a)",
                    color: "#fff",
                    border: "none",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)",
                    cursor: "pointer"
                  }}
                >
                  <UploadCloudIcon size={16} />
                  <span>Submit Follow-up Photo</span>
                </button>
              </div>

              {/* FLOW DIAGRAM (SIH MASTER STATEMENT RECOVERY FLOW) */}
              <div style={{ background: "var(--border-soft, #f8fafc)", padding: "1rem", borderRadius: "var(--radius-sm, 8px)", marginBottom: "1.5rem", border: "1px solid var(--border, #e2e8f0)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                  Milestone Protocol Pipeline (SIH Protocol)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem", alignItems: "center" }}>
                  
                  {/* Step 1 */}
                  <div style={{ background: "var(--surface, #fff)", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Day 1</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>Disease Detected</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--red, #ef4444)", marginTop: "2px" }}>Baseline Logged</div>
                  </div>

                  {/* Step 2 */}
                  <div style={{ background: "var(--surface, #fff)", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Advisory</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>CIB&RC Prescribed</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--green-mid, #16a34a)", marginTop: "2px" }}>Targeted Dose</div>
                  </div>

                  {/* Step 3 */}
                  <div style={{ background: "var(--surface, #fff)", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Scheduled</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>Follow-up Trigger</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--orange, #f97316)", marginTop: "2px" }}>Day 5 Inspection</div>
                  </div>

                  {/* Step 4 */}
                  <div style={{ background: "var(--surface, #fff)", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Day 5+</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>Farmer Upload</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--blue, #3b82f6)", marginTop: "2px" }}>Lesion Re-scan</div>
                  </div>

                  {/* Step 5 */}
                  <div style={{ background: "var(--surface, #fff)", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Comparison</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>Automated Delta</div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: timelineData.comparison ? (timelineData.comparison.status === "improving" ? "var(--green-mid)" : timelineData.comparison.status === "worsening" ? "var(--red)" : "var(--orange)") : "var(--text-muted)", marginTop: "2px" }}>
                      {timelineData.comparison ? timelineData.comparison.status.toUpperCase() : "AWAITING DAY 5"}
                    </div>
                  </div>

                </div>
              </div>

              {/* PROGRESSION DELTA HERO (IF COMPARISON EXISTS) */}
              {timelineData.comparison && (
                <div
                  style={{
                    padding: "1.2rem",
                    borderRadius: "var(--radius, 12px)",
                    marginBottom: "1.5rem",
                    border: `1px solid ${
                      timelineData.comparison.status === "improving"
                        ? "rgba(34, 197, 94, 0.3)"
                        : timelineData.comparison.status === "worsening"
                        ? "rgba(239, 68, 68, 0.3)"
                        : "rgba(234, 179, 8, 0.3)"
                    }`,
                    background:
                      timelineData.comparison.status === "improving"
                        ? "var(--green-light, #ecfdf5)"
                        : timelineData.comparison.status === "worsening"
                        ? "var(--red-light, #fef2f2)"
                        : "var(--yellow-light, #fefce8)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background:
                            timelineData.comparison.status === "improving"
                              ? "var(--green-mid, #16a34a)"
                              : timelineData.comparison.status === "worsening"
                              ? "var(--red, #ef4444)"
                              : "var(--yellow, #eab308)",
                          color: "#fff"
                        }}
                      >
                        {timelineData.comparison.status === "improving" ? (
                          <TrendingDownIcon size={22} />
                        ) : timelineData.comparison.status === "worsening" ? (
                          <TrendingUpIcon size={22} />
                        ) : (
                          <MinusIcon size={22} />
                        )}
                      </span>
                      <div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
                          Recovery Assessment: {timelineData.comparison.status.toUpperCase()}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {timelineData.comparison.explanation}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)" }}>
                        {timelineData.comparison.severityDelta > 0 ? "+" : ""}
                        {timelineData.comparison.severityDelta}%
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Net Lesion Severity Shift
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SIDE-BY-SIDE VISUAL COMPARISON (DAY 1 vs DAY 5) */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.75rem" }}>
                  Visual Progression: Baseline vs Follow-up
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
                  {/* Day 1 Card */}
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", overflow: "hidden", background: "var(--surface)" }}>
                    <div style={{ padding: "0.6rem 0.9rem", background: "var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>Day 1 Baseline Foliage</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {new Date(timelineData.case.opened_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ height: "220px", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {timelineData.comparison?.day1?.imageUrl || timelineData.case?.day1_image_url ? (
                        <img
                          src={(timelineData.comparison?.day1?.imageUrl || timelineData.case?.day1_image_url).startsWith("http") ? (timelineData.comparison?.day1?.imageUrl || timelineData.case?.day1_image_url) : `${API_BASE}${timelineData.comparison?.day1?.imageUrl || timelineData.case?.day1_image_url}`}
                          alt="Day 1 Baseline"
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <div style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
                          <LeafIcon size={32} color="#475569" style={{ margin: "0 auto 8px" }} />
                          <div>Initial foliage scan preserved in database archives</div>
                        </div>
                      )}
                      <div style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.75)", color: "#fff", padding: "3px 8px", borderRadius: "4px", fontSize: "0.72rem" }}>
                        Severity: {timelineData.comparison?.day1?.severityPct || timelineData.case.initial_severity_pct}%
                      </div>
                    </div>
                    <div style={{ padding: "0.75rem 0.9rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <div><strong>Condition:</strong> {timelineData.case.initial_condition}</div>
                      <div><strong>Confidence:</strong> {((timelineData.case.initial_confidence || 0.92) * 100).toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Day 5 Card */}
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", overflow: "hidden", background: "var(--surface)" }}>
                    <div style={{ padding: "0.6rem 0.9rem", background: "var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>
                        Day {timelineData.comparison?.latest?.dayOffset || 5} Inspection
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {timelineData.comparison?.latest?.inspectedAt ? new Date(timelineData.comparison.latest.inspectedAt).toLocaleDateString() : "Pending"}
                      </span>
                    </div>
                    <div style={{ height: "220px", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {timelineData.comparison?.latest?.imageUrl ? (
                        <img
                          src={timelineData.comparison.latest.imageUrl.startsWith("http") ? timelineData.comparison.latest.imageUrl : `${API_BASE}${timelineData.comparison.latest.imageUrl}`}
                          alt="Follow-up Foliage"
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <div style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
                          <ClockIcon size={32} color="#eab308" style={{ margin: "0 auto 8px" }} />
                          <div>No follow-up image uploaded yet</div>
                          <button
                            onClick={() => setShowSubmitModal(true)}
                            style={{
                              marginTop: "8px",
                              padding: "4px 10px",
                              background: "var(--green-mid)",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              cursor: "pointer"
                            }}
                          >
                            Upload Follow-up Now
                          </button>
                        </div>
                      )}
                      {timelineData.comparison?.latest && (
                        <div style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.75)", color: "#fff", padding: "3px 8px", borderRadius: "4px", fontSize: "0.72rem" }}>
                          Severity: {timelineData.comparison.latest.severityPct}%
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "0.75rem 0.9rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {timelineData.comparison?.latest ? (
                        <>
                          <div><strong>Detected:</strong> {timelineData.comparison.latest.condition}</div>
                          <div><strong>Compliance:</strong> Treatment Prescriptions Applied</div>
                        </>
                      ) : (
                        <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                          Scheduled for {new Date(timelineData.case.next_followup_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* TREATMENT AUDIT TRAIL */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.75rem" }}>
                  Prescribed Treatment Audit Trail
                </h3>
                {timelineData.treatments?.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
                    {timelineData.treatments.map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "0.85rem",
                          borderRadius: "var(--radius-sm, 8px)",
                          border: "1px solid var(--border)",
                          background: t.treatment_type === "chemical" ? "var(--orange-light)" : "var(--green-light)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>
                            {t.chemical_name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "#fff",
                              color: t.treatment_type === "chemical" ? "var(--orange)" : "var(--green-mid)"
                            }}
                          >
                            {t.treatment_type}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                          Dosage: <strong>{t.dosage}</strong>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Application Date: {new Date(t.application_date || timelineData.case.opened_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "1rem", borderRadius: "8px", background: "var(--border-soft)", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    Standard bio-fungicide protocol prescribed at Day 1 scan.
                  </div>
                )}
              </div>

              {/* TIMELINE MILESTONE LOG */}
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.75rem" }}>
                  Milestone Inspection Log
                </h3>
                <div style={{ borderLeft: "2px solid var(--border)", paddingLeft: "1.2rem", marginLeft: "0.5rem" }}>
                  {timelineData.timeline?.map((event, idx) => (
                    <div key={idx} style={{ position: "relative", marginBottom: "1.2rem" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: "-1.55rem",
                          top: "2px",
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: event.type === "initial_diagnosis" ? "var(--red)" : event.type === "followup_inspection" ? "var(--green-mid)" : "var(--orange)",
                          border: "2px solid #fff"
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>
                          {event.title}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {new Date(event.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {event.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* SUBMIT FOLLOW-UP INSPECTION MODAL */}
      {showSubmitModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
            padding: "1rem"
          }}
        >
          <div
            style={{
              background: "var(--surface, #fff)",
              borderRadius: "var(--radius-lg, 16px)",
              maxWidth: "540px",
              width: "100%",
              boxShadow: "var(--shadow-md)",
              overflow: "hidden",
              border: "1px solid var(--border)"
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ClockIcon size={20} color="var(--green-mid)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
                  Submit Follow-up Inspection
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "1.5rem", maxHeight: "75vh", overflowY: "auto" }}>
              {submitResult ? (
                <div style={{ textAlign: "center", padding: "1rem" }}>
                  <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "var(--green-light)", color: "var(--green-mid)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                    <CheckCircleIcon size={28} />
                  </div>
                  <h4 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>
                    Follow-up Analyzed Successfully!
                  </h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                    Status: <strong style={{ color: submitResult.progression.status === "improving" ? "var(--green-mid)" : "var(--red)" }}>{submitResult.progression.status.toUpperCase()}</strong> ({submitResult.progression.severityDelta}% net shift).
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                    {submitResult.progression.explanation}
                  </p>
                  <button
                    onClick={handleCloseModal}
                    style={{
                      padding: "0.6rem 1.5rem",
                      background: "var(--green-mid)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "var(--radius-sm, 8px)",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Done & View Comparison
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitFollowup}>
                  <div style={{ marginBottom: "1.2rem" }}>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem" }}>
                      Upload Fresh Foliage Photo (Day 5 / Follow-up)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: "2px dashed var(--border)",
                        borderRadius: "var(--radius-sm, 8px)",
                        padding: "1.5rem",
                        textAlign: "center",
                        cursor: "pointer",
                        background: followupPreview ? "#000" : "var(--border-soft)",
                        transition: "var(--transition)"
                      }}
                    >
                      {followupPreview ? (
                        <img
                          src={followupPreview}
                          alt="Followup Preview"
                          style={{ maxHeight: "180px", margin: "0 auto", borderRadius: "4px" }}
                        />
                      ) : (
                        <div>
                          <UploadCloudIcon size={32} color="var(--green-mid)" style={{ margin: "0 auto 8px" }} />
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
                            Click to select photo
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            JPEG, PNG or WEBP from field camera
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem" }}>
                        Days Since Initial Scan
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={dayOffset}
                        onChange={(e) => setDayOffset(parseInt(e.target.value) || 5)}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", color: "var(--text)", cursor: "pointer", paddingBottom: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={treatmentFollowed}
                          onChange={(e) => setTreatmentFollowed(e.target.checked)}
                          style={{ width: "16px", height: "16px", accentColor: "var(--green-mid)" }}
                        />
                        <span>Sprayed Prescribed Advisory</span>
                      </label>
                    </div>
                  </div>

                  <div style={{ marginBottom: "1.2rem" }}>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem" }}>
                      Field Notes / Farmer Observation
                    </label>
                    <textarea
                      rows="3"
                      placeholder="e.g. Applied recommended copper oxychloride spray on Day 2. Leaf curling has decreased."
                      value={fieldNotes}
                      onChange={(e) => setFieldNotes(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />
                  </div>

                  {submitError && (
                    <div style={{ padding: "0.6rem", background: "var(--red-light)", color: "var(--red)", borderRadius: "6px", fontSize: "0.8rem", marginBottom: "1rem" }}>
                      {submitError}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      style={{
                        padding: "0.55rem 1rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "#fff",
                        color: "var(--text-secondary)",
                        fontSize: "0.85rem",
                        cursor: "pointer"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: "0.55rem 1.2rem",
                        borderRadius: "6px",
                        border: "none",
                        background: "var(--green-mid)",
                        color: "#fff",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: submitting ? "not-allowed" : "pointer",
                        opacity: submitting ? 0.7 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {submitting ? (
                        <>
                          <RefreshIcon size={14} className="spin" />
                          <span>Analyzing Segments...</span>
                        </>
                      ) : (
                        <span>Compute Recovery Delta</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
