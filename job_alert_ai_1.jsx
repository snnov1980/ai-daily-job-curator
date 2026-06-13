import { useState, useCallback, useEffect } from "react";

// ─── Candidate Profile ────────────────────────────────────────────────────────
const PROFILE = `
Name: Sankara Narayana Nahak
Role: Senior SDET / QA Automation Lead / Test Manager
Experience: 17+ years
Current employer: JPMorgan Chase (Wire Transfer domain)
Target locations: Hyderabad, Bengaluru, Pune (India)
Seniority target: Lead / Architect / Manager / Principal level only

Domain expertise:
- Wire Transfer (Fedwire, ACH, SWIFT, CHIPS, RTP)
- BFSI — Business, Commercial, Private, Consumer Banking
- Payments, Financial Services, Compliance (PCI-DSS, SOX)

Core technical skills:
- Playwright, Selenium, Cypress, PlaywrightCLI
- Java, Python, JavaScript, TypeScript
- Rest Assured, Pact Contract Testing, GraphQL
- Appium, Espresso, XCTest
- AI Model-Agnostic Test Framework, SKILL File Architecture
- LLM Abstraction (OpenAI, Claude, Gemini)
- k6, JMeter, Gatling
- Jenkins, GitHub Actions, Docker, Kubernetes
- AWS (S3, Glue, Redshift, EMR)
- PyTest, Cucumber, TestNG, BDD
- SQL, Pandas, NumPy
- OpenTelemetry, Datadog, Testcontainers

Preferred companies (tier 1): JPMorgan India, Goldman Sachs India, Deutsche Bank India,
Barclays India, Morgan Stanley India, Citi India, HSBC India
Preferred companies (tier 2): Razorpay, PhonePe, PayU, BrowserStack
Preferred companies (tier 3): LTI Mindtree, Infosys BFSI, Wipro, TCS BFSI

Preferences:
- Minimum 15 LPA salary (ideally 30+ LPA given US experience)
- Hybrid or remote preferred
- No junior/mid-level roles (must be Lead/Senior/Principal/Manager/Architect)
- BFSI or Fintech domain strongly preferred
`;

// ─── Search queries Claude will use to find jobs ──────────────────────────────
const SEARCH_QUERIES = [
  "Senior SDET Lead Hyderabad Bengaluru Pune 2024 2025",
  "QA Automation Lead BFSI banking India hiring",
  "Test Manager automation Playwright Java Python India fintech",
  "Senior automation engineer wire transfer payments India",
  "QA Lead JPMorgan Goldman Sachs Deutsche Bank India careers",
  "SDET architect AI testing LLM India 2025",
];

// ─── Prompts ──────────────────────────────────────────────────────────────────
const SEARCH_PROMPT = (query, date) => `
Today is ${date}. Search the web for this query: "${query}"

Find real, currently open job postings. For each job found, extract:
- Job title, company, location, experience required, key skills, apply URL

Return ONLY valid JSON array (no markdown):
[
  {
    "title": "Senior SDET",
    "company": "Goldman Sachs",
    "location": "Bengaluru",
    "experience": "12-18 years",
    "skills": ["Java", "Selenium", "CI/CD"],
    "posted": "2 days ago",
    "url": "https://...",
    "snippet": "Brief description of role..."
  }
]
Return empty array [] if no relevant jobs found. Max 4 jobs per query.`;

const RATE_PROMPT = (jobs) => `
You are an expert technical recruiter. Rate these jobs for this candidate.

CANDIDATE PROFILE:
${PROFILE}

JOBS TO RATE:
${JSON.stringify(jobs, null, 2)}

For each job, return a rating. Return ONLY valid JSON array (no markdown):
[
  {
    "title": "<same title>",
    "company": "<same company>",
    "location": "<same location>",
    "url": "<same url>",
    "snippet": "<same snippet>",
    "score": <1-10>,
    "verdict": "Strong Match" | "Good Match" | "Partial Match" | "Poor Match",
    "matched_skills": ["skill1"],
    "missing_skills": ["skill1"],
    "domain_match": true | false,
    "seniority_match": true | false,
    "tier": "Tier 1" | "Tier 2" | "Tier 3" | "Other",
    "why_apply": "<one sentence why this is worth applying>",
    "red_flags": ["flag1"]
  }
]`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
  "Strong Match": { bg: "#ECFDF5", border: "#10B981", text: "#065F46", badge: "#10B981" },
  "Good Match":   { bg: "#EFF6FF", border: "#3B82F6", text: "#1E40AF", badge: "#3B82F6" },
  "Partial Match":{ bg: "#FFFBEB", border: "#F59E0B", text: "#92400E", badge: "#F59E0B" },
  "Poor Match":   { bg: "#FEF2F2", border: "#EF4444", text: "#991B1B", badge: "#EF4444" },
};

const NAVY = "#1B3A6B", ACCENT = "#2E75B6";

const Tag = ({ text, color = "#6B7280", bg = "#F3F4F6" }) => (
  <span style={{ background: bg, color, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 500, display: "inline-block", margin: "2px 3px 2px 0" }}>{text}</span>
);

const ScoreRing = ({ score }) => {
  const r = 24, c = 2 * Math.PI * r;
  const color = score >= 7 ? "#10B981" : score >= 5 ? "#F59E0B" : "#EF4444";
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
      <circle cx="30" cy="30" r={r} fill="none" stroke="#E5E7EB" strokeWidth="5" />
      <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 10)}
        strokeLinecap="round" transform="rotate(-90 30 30)" />
      <text x="30" y="35" textAnchor="middle" fontSize="15" fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
};

// ─── Job Card ─────────────────────────────────────────────────────────────────
const JobCard = ({ job, rank }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = VERDICT_CONFIG[job.verdict] || VERDICT_CONFIG["Partial Match"];
  return (
    <div style={{ border: `1.5px solid ${cfg.border}`, borderRadius: 12, background: "#fff", marginBottom: 12, overflow: "hidden", transition: "box-shadow 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
      {/* Card Header */}
      <div style={{ background: cfg.bg, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ background: NAVY, color: "#fff", borderRadius: 6, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
          {rank}
        </div>
        <ScoreRing score={job.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.title}</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{job.company} · {job.location}</div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ background: cfg.badge, color: "#fff", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{job.verdict}</span>
            {job.tier && job.tier !== "Other" && <Tag text={job.tier} color="#6D28D9" bg="#EDE9FE" />}
            {job.domain_match && <Tag text="✓ BFSI" color="#065F46" bg="#D1FAE5" />}
            {job.seniority_match && <Tag text="✓ Senior" color="#1E40AF" bg="#DBEAFE" />}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {job.url && job.url !== "N/A" && (
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              style={{ background: ACCENT, color: "#fff", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
              Apply →
            </a>
          )}
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: `1px solid ${cfg.border}`, borderRadius: 7, padding: "5px 12px", fontSize: 12, color: cfg.text, cursor: "pointer", fontWeight: 600 }}>
            {expanded ? "Less ▲" : "More ▼"}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${cfg.border}` }}>
          {job.snippet && (
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 12, lineHeight: 1.6, background: "#F9FAFB", borderRadius: 8, padding: "10px 12px" }}>
              {job.snippet}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {job.matched_skills?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Matched Skills</div>
                <div>{job.matched_skills.map(s => <Tag key={s} text={s} color="#065F46" bg="#D1FAE5" />)}</div>
              </div>
            )}
            {job.missing_skills?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Skill Gaps</div>
                <div>{job.missing_skills.map(s => <Tag key={s} text={s} color="#991B1B" bg="#FEE2E2" />)}</div>
              </div>
            )}
          </div>
          {job.why_apply && (
            <div style={{ marginTop: 12, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 12px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1E40AF" }}>💡 WHY APPLY: </span>
              <span style={{ fontSize: 13, color: "#1E40AF" }}>{job.why_apply}</span>
            </div>
          )}
          {job.red_flags?.length > 0 && (
            <div style={{ marginTop: 8, background: "#FEF9C3", border: "1px solid #FDE047", borderRadius: 8, padding: "10px 12px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#854D0E" }}>⚠ FLAGS: </span>
              <span style={{ fontSize: 13, color: "#854D0E" }}>{job.red_flags.join(" · ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Progress Step ─────────────────────────────────────────────────────────────
const ProgressStep = ({ label, status }) => {
  const icon = status === "done" ? "✓" : status === "active" ? "⟳" : "○";
  const color = status === "done" ? "#10B981" : status === "active" ? ACCENT : "#D1D5DB";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <span style={{ color, fontWeight: 700, fontSize: 14, width: 18, textAlign: "center",
        animation: status === "active" ? "spin 1s linear infinite" : "none", display: "inline-block" }}>{icon}</span>
      <span style={{ fontSize: 13, color: status === "pending" ? "#9CA3AF" : "#374151", fontWeight: status === "active" ? 600 : 400 }}>{label}</span>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function JobCurator() {
  const [jobs, setJobs] = useState([]);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [filter, setFilter] = useState("All");
  const [tab, setTab] = useState("jobs");
  const [preferences, setPreferences] = useState({
    minScore: 6,
    locations: ["Hyderabad", "Bengaluru", "Pune"],
    tiers: ["Tier 1", "Tier 2", "Tier 3", "Other"],
    verdicts: ["Strong Match", "Good Match", "Partial Match"],
  });

  const setStep = (label, status) => {
    setSteps(prev => {
      const existing = prev.findIndex(s => s.label === label);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { label, status };
        return updated;
      }
      return [...prev, { label, status }];
    });
  };

  const callClaude = async (prompt, useSearch = false) => {
    const body = {
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    };
    if (useSearch) {
      body.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    // Extract all text blocks
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    // Find JSON array in response
    const match = clean.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  };

  const runCuration = useCallback(async () => {
    setRunning(true);
    setJobs([]);
    setSteps([]);
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    try {
      // Step 1: Search for jobs across all queries
      const allFound = [];
      for (let i = 0; i < SEARCH_QUERIES.length; i++) {
        const q = SEARCH_QUERIES[i];
        setStep(`Searching: "${q.substring(0, 40)}..."`, "active");
        try {
          const found = await callClaude(SEARCH_PROMPT(q, today), true);
          if (Array.isArray(found)) allFound.push(...found);
        } catch (_) {}
        setStep(`Searching: "${q.substring(0, 40)}..."`, "done");
      }

      // Deduplicate by title+company
      const seen = new Set();
      const unique = allFound.filter(j => {
        const key = `${j.title}-${j.company}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setStep(`Found ${unique.length} unique jobs — rating against your profile...`, "active");

      // Step 2: Rate in batches of 5
      const rated = [];
      const batchSize = 5;
      for (let i = 0; i < unique.length; i += batchSize) {
        const batch = unique.slice(i, i + batchSize);
        try {
          const ratings = await callClaude(RATE_PROMPT(batch));
          if (Array.isArray(ratings)) rated.push(...ratings);
        } catch (_) {
          // fallback: add unrated
          rated.push(...batch.map(j => ({ ...j, score: 5, verdict: "Partial Match" })));
        }
      }

      setStep(`Found ${unique.length} unique jobs — rating against your profile...`, "done");
      setStep("Sorting by match score...", "active");

      // Sort by score desc
      const sorted = rated.sort((a, b) => (b.score || 0) - (a.score || 0));
      setJobs(sorted);
      setLastRun(new Date().toLocaleTimeString());
      setStep("Sorting by match score...", "done");
      setStep(`✨ Done — ${sorted.length} jobs curated for you today`, "done");
      setTab("jobs");
    } catch (err) {
      setStep(`Error: ${err.message}`, "done");
    } finally {
      setRunning(false);
    }
  }, []);

  // Filtered jobs
  const filtered = jobs.filter(j => {
    if (j.score < preferences.minScore) return false;
    if (filter !== "All" && j.verdict !== filter) return false;
    return true;
  });

  const counts = {
    "Strong Match": jobs.filter(j => j.verdict === "Strong Match").length,
    "Good Match": jobs.filter(j => j.verdict === "Good Match").length,
    "Partial Match": jobs.filter(j => j.verdict === "Partial Match").length,
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "#F1F5F9" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${ACCENT} 100%)`, padding: "22px 24px 20px", color: "#fff" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>🤖 Daily Job Curator</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>AI-powered job search · BFSI & SDET roles · Hyderabad / Bengaluru / Pune</div>
            </div>
            <button onClick={runCuration} disabled={running}
              style={{ background: running ? "rgba(255,255,255,0.2)" : "#fff", color: running ? "#fff" : NAVY,
                border: "none", borderRadius: 9, padding: "10px 22px", fontSize: 13, fontWeight: 800,
                cursor: running ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <span style={{ animation: running ? "spin 1s linear infinite" : "none", display: "inline-block", fontSize: 16 }}>
                {running ? "⟳" : "▶"}
              </span>
              {running ? "Searching..." : "Run Today's Search"}
            </button>
          </div>

          {/* Stats */}
          {jobs.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              {[
                ["Total Found", jobs.length, "#93C5FD"],
                ["Strong Matches", counts["Strong Match"], "#6EE7B7"],
                ["Good Matches", counts["Good Match"], "#FDE68A"],
                ["Avg Score", (jobs.reduce((a, b) => a + (b.score || 0), 0) / jobs.length).toFixed(1), "#C4B5FD"],
                ["Last Run", lastRun, "#FCA5A5"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "7px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 18, background: "#E2E8F0", borderRadius: 8, padding: 3, width: "fit-content" }}>
          {[["jobs", `🎯 Jobs (${filtered.length})`], ["progress", "📡 Search Log"], ["settings", "⚙️ Preferences"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: tab === id ? "#fff" : "transparent", color: tab === id ? NAVY : "#64748B",
                boxShadow: tab === id ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Jobs Tab */}
        {tab === "jobs" && (
          <>
            {jobs.length === 0 && !running ? (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>🔍</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#1E293B" }}>Ready to find your next role</div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>
                  Claude will search LinkedIn, Naukri, and company career pages, then rate every job against your exact profile — BFSI domain, wire transfer experience, and target cities.
                </div>
                <button onClick={runCuration}
                  style={{ marginTop: 20, background: `linear-gradient(135deg, ${NAVY}, ${ACCENT})`, color: "#fff",
                    border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  ▶ Run Today's Job Search
                </button>
                <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  {["Playwright", "BFSI", "Java", "Wire Transfer", "CI/CD", "Python", "AI Testing"].map(s => (
                    <Tag key={s} text={s} color={ACCENT} bg="#EFF6FF" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Filter bar */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Filter:</span>
                  {["All", "Strong Match", "Good Match", "Partial Match"].map(v => (
                    <button key={v} onClick={() => setFilter(v)}
                      style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${filter === v ? ACCENT : "#CBD5E1"}`,
                        background: filter === v ? ACCENT : "#fff", color: filter === v ? "#fff" : "#475569",
                        fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {v} {v !== "All" ? `(${counts[v] || 0})` : `(${jobs.length})`}
                    </button>
                  ))}
                </div>
                {filtered.map((job, i) => <JobCard key={i} job={job} rank={i + 1} />)}
                {filtered.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                    No jobs match the current filter. Try "All" to see everything.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Progress Tab */}
        {tab === "progress" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: 20 }}>
            <div style={{ fontWeight: 700, color: NAVY, fontSize: 14, marginBottom: 14 }}>Search Log</div>
            {steps.length === 0 ? (
              <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: 30 }}>
                Run a search to see the log here.
              </div>
            ) : (
              steps.map((s, i) => <ProgressStep key={i} label={s.label} status={s.status} />)
            )}
          </div>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: 20 }}>
            <div style={{ fontWeight: 700, color: NAVY, fontSize: 14, marginBottom: 16 }}>Search Preferences</div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
                Minimum Match Score: <span style={{ color: ACCENT }}>{preferences.minScore}/10</span>
              </label>
              <input type="range" min={1} max={10} value={preferences.minScore}
                onChange={e => setPreferences(p => ({ ...p, minScore: +e.target.value }))}
                style={{ width: "100%", accentColor: ACCENT }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                <span>Show all</span><span>Perfect match only</span>
              </div>
            </div>

            <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Profile Summary</div>
              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7 }}>
                <b>Target:</b> Senior SDET / QA Lead / Test Manager<br />
                <b>Domain:</b> BFSI, Wire Transfer, Payments<br />
                <b>Locations:</b> Hyderabad · Bengaluru · Pune<br />
                <b>Tier 1 Companies:</b> JPMorgan, Goldman Sachs, Deutsche Bank, Barclays<br />
                <b>Key Skills:</b> Playwright, Java, Python, Pact, AI Frameworks, CI/CD
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
