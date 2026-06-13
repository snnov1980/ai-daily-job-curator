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
export const SEARCH_QUERIES = [
  "Senior SDET Lead jobs Hyderabad Bengaluru Pune site:linkedin.com/jobs",
  "QA Automation Lead BFSI banking India hiring site:naukri.com",
  "Test Manager automation Playwright Java Python India fintech LinkedIn Naukri",
  "Senior automation engineer wire transfer payments India jobs",
  "QA Lead JPMorgan Goldman Sachs Deutsche Bank India careers openings",
  "SDET architect AI testing LLM India hiring LinkedIn Naukri",
];

// ─── Prompts ──────────────────────────────────────────────────────────────────
export const SEARCH_PROMPT = (query, date) => `
Today is ${date}. Use web search to find this: "${query}"

Find real, currently open job postings on LinkedIn (linkedin.com/jobs) and
Naukri.com (naukri.com), plus company career pages. Only include postings that
appear genuinely open right now. For each job found, extract the real details.

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
    "url": "https://...",
    "snippet": "Brief description of role..."
  }
]
Return an empty array [] if no relevant jobs are found. Maximum 4 jobs per query.
The "url" must be a real link to the actual posting, not a search page.`;

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
