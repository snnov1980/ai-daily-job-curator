import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import {
  SEARCH_QUERIES,
  SEARCH_PROMPT,
  RATE_PROMPT,
} from "./profile.js";

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

// Call Claude once. When useSearch is true, the server-side web_search tool runs
// automatically; we loop on stop_reason "pause_turn" to let the server finish its
// search/sampling loop before reading the final text.
async function callClaude(prompt, { useSearch = false } = {}) {
  const tools = useSearch
    ? [{ type: "web_search_20260209", name: "web_search" }]
    : undefined;

  let messages = [{ role: "user", content: prompt }];
  let last;

  for (let i = 0; i < 8; i++) {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 8000,
      ...(tools ? { tools } : {}),
      messages,
    });
    last = response;

    if (response.stop_reason === "pause_turn") {
      // Server tool hit its iteration limit; re-send to resume.
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

// Search every query, collect raw postings, dedupe by title+company.
export async function findJobs({ today, log = () => {} }) {
  const allFound = [];

  for (const query of SEARCH_QUERIES) {
    log(`Searching: ${query}`);
    try {
      const found = await callClaude(SEARCH_PROMPT(query, today), {
        useSearch: true,
      });
      allFound.push(...found);
      log(`  → ${found.length} postings`);
    } catch (err) {
      log(`  → search failed: ${err.message}`);
    }
  }

  const seen = new Set();
  const unique = allFound.filter((j) => {
    if (!j || !j.title || !j.company) return false;
    const key = `${j.title}-${j.company}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  log(`Deduplicated to ${unique.length} unique postings`);
  return unique;
}

// Rate jobs in batches against the profile.
export async function rateJobs(jobs, { log = () => {} } = {}) {
  const rated = [];
  const batchSize = 5;

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    log(`Rating jobs ${i + 1}-${i + batch.length} of ${jobs.length}`);
    try {
      const ratings = await callClaude(RATE_PROMPT(batch));
      if (ratings.length) {
        rated.push(...ratings);
      } else {
        // Fallback: keep the postings unrated rather than dropping them.
        rated.push(
          ...batch.map((j) => ({ ...j, score: 5, verdict: "Partial Match" })),
        );
      }
    } catch (err) {
      log(`  → rating failed: ${err.message}`);
      rated.push(
        ...batch.map((j) => ({ ...j, score: 5, verdict: "Partial Match" })),
      );
    }
  }

  return rated;
}

// Full pipeline: search → rate → filter by minScore → sort highest first.
export async function curate({ log = () => {} } = {}) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const unique = await findJobs({ today, log });
  if (unique.length === 0) return { today, jobs: [] };

  const rated = await rateJobs(unique, { log });

  const jobs = rated
    .filter((j) => (j.score || 0) >= config.minScore)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, config.maxJobs);

  log(`Final: ${jobs.length} jobs at score >= ${config.minScore}`);
  return { today, jobs };
}
