// ─── Candidate Profile ────────────────────────────────────────────────────────
// Edit this to tune what the curator searches for and how it scores matches.
export const PROFILE = `
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

Preferred companies (tier 1): JPMorgan India, Goldman Sachs India, Deutsche Bank India, U.S. Bank India, Barclays India, Morgan Stanley India, Citi India, HSBC India
Preferred companies (tier 2): Razorpay, PhonePe, PayU, BrowserStack
Preferred companies (tier 3): LTI Mindtree, Infosys BFSI, Wipro, TCS BFSI

Preferences:
- Minimum 40 LPA salary (ideally 30+ LPA given US experience)
- Hybrid or remote preferred
- No junior/mid-level roles (must be Lead/Senior/Principal/Manager/Architect)
- BFSI or Fintech domain strongly preferred
- Jobs are actively hiring (not just posted) and posted within the last 7 days
`;

// ─── Search queries Claude runs against the live web (LinkedIn, Naukri, careers) ──
// export const SEARCH_QUERIES = [
//   "Senior SDET Lead jobs Hyderabad Bengaluru Pune site:linkedin.com/jobs",
//   "QA Automation Lead BFSI banking India hiring site:naukri.com",
//   "Test Manager automation Playwright Java Python India fintech LinkedIn Naukri",
//   "Senior automation engineer wire transfer payments India jobs",
//   "QA Lead JPMorgan Goldman Sachs Deutsche Bank India careers openings",
//   "SDET architect AI testing LLM India hiring LinkedIn Naukri",
// ];

export const SEARCH_QUERIES = [
  // 1. Title-first (no domain) — consolidates old 1,2,3,4
  "SDET Lead OR QA Architect OR Principal QA Engineer OR Staff SDET India 2026 site:linkedin.com/jobs OR site:naukri.com",

  // 2. BFSI/fintech domain on job boards — consolidates old 5,8
  "QA Automation Lead OR Test Manager BFSI OR fintech OR banking OR insurance India site:linkedin.com/jobs OR site:naukri.com",

  // 3. Specific fintech employers — kept as-is (unique)
  "SDET OR QA Lead Razorpay OR PhonePe OR Paytm OR Cred OR BrowserStack India careers",

  // 4. Payments domain + stack — consolidates old 9,10,11
  "Senior SDET OR QA Lead SWIFT OR ACH OR wire transfer OR payments Playwright OR Selenium OR RestAssured India jobs",

  // 5. Global bank GCCs (tier 1) — kept as-is (unique)
  "QA Lead SDET JPMorgan OR Goldman Sachs OR Deutsche Bank OR Citi OR HSBC OR Barclays India careers",

  // 6. Global bank GCCs (tier 2) — kept as-is (unique)
  "BNY Mellon OR Standard Chartered OR Morgan Stanley India QA automation engineer openings 2026",

  // 7. AI/GenAI testing — consolidates old 14,15
  "SDET OR QA Lead AI testing OR GenAI OR LLM OR RAG OR model evaluation India 2026 site:linkedin.com OR site:naukri.com",

  // 8. Consultancies (AI angle) — kept as-is (unique)
  "Thoughtworks OR TCS OR Infosys OR Wipro QA automation lead AI testing India",

  // 9. Niche job boards — kept as-is (unique)
  "SDET Lead OR QA Automation Lead India site:glassdoor.com OR site:indeed.co.in OR site:cutshort.io",

  // 10. US Bank direct careers (unique, pulled from query 1)
  "Senior SDET OR QA Automation Lead site:careers.usbank.com",
];



// ─── Prompts ──────────────────────────────────────────────────────────────────
export const SEARCH_PROMPT = (query, date) => `
Today is ${date}. Use web search to find this: "${query}"

Search LinkedIn (linkedin.com/jobs), Naukri.com (naukri.com), and company
career pages.

CRITICAL — verify each posting is LIVE before including it:
1. For every promising result, use the web_fetch tool to OPEN the actual
   posting URL and read the page.
2. EXCLUDE the posting if the page shows any of: "no longer accepting
   applications", "this job is no longer available", "position closed",
   "expired", "applications closed", a 404/removed page, or if the URL only
   resolves to a search/listing page rather than a specific job.
3. EXCLUDE anything posted more than 7 days ago. Read the posting date from the
   page (e.g. "Posted 3 days ago", "Reposted 2 weeks ago" → exclude).
4. Only include a posting you have actually opened and confirmed is currently
   open and recent. If you cannot open/verify it, DO NOT include it.

It is far better to return fewer verified-open jobs (or an empty array) than to
include stale or closed postings. Quality over quantity.

Return ONLY a valid JSON array (no markdown, no commentary):
[
  {
    "title": "Senior SDET",
    "company": "Goldman Sachs",
    "location": "Bengaluru",
    "experience": "12-18 years",
    "skills": ["Java", "Selenium", "CI/CD"],
    "source": "LinkedIn",
    "posted": "2 days ago",
    "posted_days_ago": 2,
    "status": "Open",
    "url": "https://...",
    "snippet": "Brief description of role..."
  }
]
Rules for the fields:
- "status" must be "Open" only if you opened the page and confirmed it is
  accepting applications. Use "Unknown" if you could not open it (and prefer to
  omit such jobs entirely). Never return a posting you confirmed is closed.
- "posted_days_ago" is an integer (days since posted) read from the page, or
  null if genuinely unknown.
- "url" must be a real link to the actual posting, not a search page.
Return an empty array [] if no verified-open jobs are found. Maximum 4 jobs per query.`;

export const RATE_PROMPT = (jobs) => `
You are an expert technical recruiter. Rate these jobs for this candidate.

CANDIDATE PROFILE:
${PROFILE}

JOBS TO RATE:
${JSON.stringify(jobs, null, 2)}

For each job, return a rating. Return ONLY a valid JSON array (no markdown):
[
  {
    "title": "<same title>",
    "company": "<same company>",
    "location": "<same location>",
    "source": "<LinkedIn | Naukri | Company site>",
    "url": "<same url>",
    "snippet": "<same snippet>",
    "score": <integer 1-10>,
    "verdict": "Strong Match" | "Good Match" | "Partial Match" | "Poor Match",
    "matched_skills": ["skill1"],
    "missing_skills": ["skill1"],
    "domain_match": true | false,
    "seniority_match": true | false,
    "tier": "Tier 1" | "Tier 2" | "Tier 3" | "Other",
    "why_apply": "<one sentence on why this is worth applying>",
    "red_flags": ["flag1"]
  }
]`;

// Used by the external-search path (SEARCH_PROVIDER=tavily): one call that extracts
// structured job details from raw search results, optionally verifies they're
// live, and rates them — combining what SEARCH_PROMPT + RATE_PROMPT do for the
// Claude-search path.
export const EXTRACT_RATE_PROMPT = (candidates, date, { verify }) => `
You are an expert technical recruiter. Today is ${date}.

Below are raw web-search results for potential job postings. For each genuine job
posting, extract the real details and rate it against the candidate profile.
${
  verify
    ? `\nVERIFY status with the web_fetch tool — open each posting URL and read the page:
- If the page clearly shows "no longer accepting applications", "expired",
  "position closed", or is a 404/removed page → EXCLUDE it entirely.
- If the page confirms it is open and accepting → set "status" to "Open".
- If you CANNOT open the page (login wall, blocked, timeout — common on LinkedIn)
  → still INCLUDE the job, but set "status" to "Unknown". Do NOT guess "Open".
Keep the digest useful: include open and unknown jobs; only drop ones you have
positively confirmed are closed. Many good LinkedIn jobs can't be opened — keep
those as "Unknown" rather than discarding them.`
    : `\nUse the snippet and posted date to judge recency and status; exclude only
ones that are clearly closed. Set "status" to "Unknown" since you are not opening
the pages — do not guess "Open".`
}

CANDIDATE PROFILE:
${PROFILE}

SEARCH RESULTS:
${JSON.stringify(candidates, null, 2)}

Skip non-job results (news articles, generic listing/search pages, company
homepages). Return ONLY a valid JSON array (no markdown), one object per real job:
[
  {
    "title": "...",
    "company": "...",
    "location": "...",
    "source": "LinkedIn | Naukri | Company site",
    "url": "<the posting url>",
    "snippet": "...",
    "posted": "<e.g. 3 days ago, or null>",
    "posted_days_ago": <integer or null>,
    "status": "Open" | "Unknown",
    "score": <integer 1-10>,
    "verdict": "Strong Match" | "Good Match" | "Partial Match" | "Poor Match",
    "matched_skills": ["skill1"],
    "missing_skills": ["skill1"],
    "domain_match": true | false,
    "seniority_match": true | false,
    "tier": "Tier 1" | "Tier 2" | "Tier 3" | "Other",
    "why_apply": "<one sentence on why this is worth applying>",
    "red_flags": ["flag1"]
  }
]
Infer company/location from the title, snippet, or URL. Return [] if none qualify.`;
