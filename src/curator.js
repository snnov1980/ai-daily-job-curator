import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import {
  SEARCH_QUERIES,
  SEARCH_PROMPT,
  RATE_PROMPT,
  EXTRACT_RATE_PROMPT,
} from "./profile.js";
import { searchAll } from "./search.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Extract the first JSON array found in a text blob, tolerating ```json fences
// and surrounding prose. Returns [] if nothing parseable is found.
function extractJsonArray(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Concatenate all text blocks from a message's content.
function textOf(message) {
  return (message.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

const webSearchTool = () => ({
  type: "web_search_20260209",
  name: "web_search",
  max_uses: config.maxSearchUses,
  allowed_callers: ["direct"], // required on Haiku (no programmatic tool calling)
});

// web_fetch opens a posting to verify it's live/recent. max_content_tokens caps
// the cost per page; max_uses caps how many pages per call.
// allowed_callers:["direct"] is required on Haiku (and other models that don't
// support programmatic tool calling) — without it the API 400s.
const webFetchTool = () => ({
  type: "web_fetch_20260209",
  name: "web_fetch",
  max_uses: config.maxFetchUses,
  max_content_tokens: config.fetchMaxTokens,
  allowed_callers: ["direct"],
});

// Call Claude once, looping on stop_reason "pause_turn" so server-side tools
// (web_search / web_fetch) can finish before we read the final text.
async function callClaude(prompt, { model, tools } = {}) {
  const hasTools = Array.isArray(tools) && tools.length > 0;
  let messages = [{ role: "user", content: prompt }];
  let last;

  for (let i = 0; i < 12; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      ...(hasTools ? { tools } : {}),
      messages,
    });
    last = response;

    if (response.stop_reason === "pause_turn") {
      messages = [
        { role: "user", content: prompt },
        { role: "assistant", content: response.content },
      ];
      continue;
    }
    break;
  }

  return extractJsonArray(textOf(last));
}

function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((j) => {
    if (!j || !j.title) return false;
    const key = `${j.title}-${j.company || j.url || ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Drop anything flagged closed/expired or older than the freshness window.
function freshnessFilter(jobs) {
  return jobs.filter((j) => {
    const status = String(j.status || "").toLowerCase();
    if (status === "closed" || status === "expired") return false;
    const days = Number(j.posted_days_ago);
    if (Number.isFinite(days) && days > config.maxPostedDays) return false;
    return true;
  });
}

// ─── Provider A: Claude built-in web_search ───────────────────────────────────
async function curateWithClaudeSearch({ today, log }) {
  const allFound = [];
  const tools = config.verifyPostings
    ? [webSearchTool(), webFetchTool()]
    : [webSearchTool()];

  for (const query of SEARCH_QUERIES) {
    log(`Searching (Claude): ${query}`);
    try {
      const found = await callClaude(SEARCH_PROMPT(query, today), {
        model: config.searchModel,
        tools,
      });
      allFound.push(...found);
      log(`  → ${found.length} postings`);
    } catch (err) {
      log(`  → search failed: ${err.message}`);
    }
  }

  const unique = dedupe(allFound.filter((j) => j && j.title && j.company));
  log(`Deduplicated to ${unique.length} unique postings — rating...`);
  return rateJobs(unique, { log });
}

// Rate already-extracted jobs in batches (Claude-search path only).
async function rateJobs(jobs, { log = () => {} } = {}) {
  const rated = [];
  const batchSize = 5;
  const keyOf = (j) => `${j.title}-${j.company}`.toLowerCase();
  const original = new Map(jobs.map((j) => [keyOf(j), j]));
  const merge = (r) => ({ ...(original.get(keyOf(r)) || {}), ...r });

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    log(`Rating jobs ${i + 1}-${i + batch.length} of ${jobs.length}`);
    try {
      const ratings = await callClaude(RATE_PROMPT(batch), {
        model: config.rateModel,
      });
      if (ratings.length) rated.push(...ratings.map(merge));
      else
        rated.push(
          ...batch.map((j) => ({ ...j, score: 5, verdict: "Partial Match" })),
        );
    } catch (err) {
      log(`  → rating failed: ${err.message}`);
      rated.push(
        ...batch.map((j) => ({ ...j, score: 5, verdict: "Partial Match" })),
      );
    }
  }
  return rated;
}

// ─── Provider B: free external search (Tavily) + Claude verify/rate ───────────
async function curateWithExternalSearch({ today, log }) {
  const raw = await searchAll(SEARCH_QUERIES, { log });
  const candidates = freshnessFilter(dedupe(raw));
  log(
    `Search returned ${raw.length} results; ${candidates.length} unique & recent — extracting + rating...`,
  );
  if (candidates.length === 0) return [];

  const tools = config.verifyPostings ? [webFetchTool()] : undefined;
  const rated = [];
  const batchSize = 5;

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    log(`Extract+rate ${i + 1}-${i + batch.length} of ${candidates.length}`);
    try {
      const r = await callClaude(
        EXTRACT_RATE_PROMPT(batch, today, { verify: config.verifyPostings }),
        { model: config.rateModel, tools },
      );
      rated.push(...r);
    } catch (err) {
      log(`  → extract/rate failed: ${err.message}`);
    }
  }
  return rated;
}

// ─── Full pipeline: search → rate → filter → sort highest first ───────────────
export async function curate({ log = () => {} } = {}) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const rated =
    config.searchProvider === "claude"
      ? await curateWithClaudeSearch({ today, log })
      : await curateWithExternalSearch({ today, log });

  const jobs = freshnessFilter(rated)
    .filter((j) => (j.score || 0) >= config.minScore)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, config.maxJobs);

  log(`Final: ${jobs.length} jobs at score >= ${config.minScore}`);
  return { today, jobs };
}
