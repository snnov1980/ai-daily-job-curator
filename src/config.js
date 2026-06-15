// Central configuration, read from environment variables.
// In local dev these come from a .env file (loaded by src/index.js via --env-file).
// In GitHub Actions they come from repository secrets.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env file (local) or as a GitHub Actions secret.`,
    );
  }
  return value;
}

export const config = {
  // Anthropic
  anthropicApiKey: required("ANTHROPIC_API_KEY"),

  // Two models:
  // - searchModel handles the token-HEAVY search step (claude provider) → cheap.
  // - rateModel does extraction + verification + scoring, where judgment and
  //   instruction-following matter most → Sonnet by default for quality. This is
  //   a low-token step, so the cost impact is small. Drop to claude-haiku-4-5 to
  //   minimise cost, or claude-opus-4-8 for the sharpest scoring.
  // CLAUDE_MODEL overrides both at once if you want a single model everywhere.
  searchModel:
    process.env.SEARCH_MODEL || process.env.CLAUDE_MODEL || "claude-haiku-4-5",
  rateModel:
    process.env.RATE_MODEL || process.env.CLAUDE_MODEL || "claude-sonnet-4-6",

  // Search provider:
  //   "tavily" → free Tavily Search API (set TAVILY_API_KEY). Cheapest — no paid
  //              web_search fee; Claude is used only to verify+rate.
  //   "claude" → Claude's built-in web_search (~$10/1,000 searches).
  searchProvider: process.env.SEARCH_PROVIDER || "tavily",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  searchCount: Number(process.env.SEARCH_COUNT || 12), // results per query
  // Tavily depth: "advanced" finds more & better results (2 credits/search vs 1);
  // still well within the free tier at this volume. "basic" is cheaper/shallower.
  searchDepth: process.env.SEARCH_DEPTH || "advanced",

  // Verify each posting is live by opening it with web_fetch. true = no expired
  // jobs but more tokens; false = cheapest (search snippets only, may include
  // some stale postings). Set VERIFY_POSTINGS=false for the absolute lowest cost.
  verifyPostings: process.env.VERIFY_POSTINGS !== "false",

  // Cap tokens pulled from each fetched page. This is the main cost control for
  // verification — a small cap is enough to read date + "accepting applications".
  fetchMaxTokens: Number(process.env.FETCH_MAX_TOKENS || 3000),

  // Hard caps on tool calls per query, so a single run can't balloon in cost.
  maxSearchUses: Number(process.env.MAX_SEARCH_USES || 3),
  maxFetchUses: Number(process.env.MAX_FETCH_USES || 4),

  // Gmail SMTP (nodemailer)
  gmailUser: required("GMAIL_USER"),
  gmailAppPassword: required("GMAIL_APP_PASSWORD"),

  // Where to send the digest (defaults to the sending Gmail account)
  mailTo: process.env.MAIL_TO || process.env.GMAIL_USER,

  // Only email jobs scoring at or above this (1-10). Mirrors the UI's minScore.
  minScore: Number(process.env.MIN_SCORE || 5),

  // Max jobs to include in the email (after sorting by score desc).
  maxJobs: Number(process.env.MAX_JOBS || 25),

  // Drop postings older than this many days (when the posting date is known).
  // 14 is a good balance — 7 was too tight and starved the digest of results.
  maxPostedDays: Number(process.env.MAX_POSTED_DAYS || 21),

  // If true, skip sending the email and just print the result to the console.
  dryRun: process.env.DRY_RUN === "true",
};
