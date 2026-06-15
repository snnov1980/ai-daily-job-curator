// Tavily Search API client — an LLM-native search API with a genuinely free
// tier (~1,000 searches/month, no credit card). Replaces Claude's paid
// web_search. Uses Node's built-in fetch (Node 18+), so no extra npm dependency.
//
// Get a free key: https://app.tavily.com/ → sign up → copy the tvly-... API key.
import { config } from "./config.js";

function deriveSource(url = "") {
  const u = url.toLowerCase();
  if (u.includes("linkedin.")) return "LinkedIn";
  if (u.includes("naukri.")) return "Naukri";
  return "Company site";
}

// Map our day-window onto Tavily's time_range so the API itself biases recent.
function timeRange(maxDays) {
  if (maxDays <= 1) return "day";
  if (maxDays <= 7) return "week";
  if (maxDays <= 31) return "month";
  return "year";
}

function daysAgo(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86_400_000));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tavilySearch(query) {
  if (!config.tavilyApiKey) {
    throw new Error(
      "TAVILY_API_KEY is not set. Get a free key at https://app.tavily.com/ " +
        "(no credit card), or set SEARCH_PROVIDER=claude to use Claude's built-in web search.",
    );
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.tavilyApiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic", // 1 credit per search (cheapest); "advanced" costs 2
      max_results: config.searchCount,
      time_range: timeRange(config.maxPostedDays),
      topic: "general",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tavily search ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const results = data?.results || [];
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content || "",
    source: deriveSource(r.url || ""),
    posted: null, // Tavily "general" topic rarely returns a date
    posted_days_ago: daysAgo(r.published_date),
  }));
}

// Run every query against the search provider, with a small delay to stay
// comfortably inside free-tier rate limits.
export async function searchAll(queries, { log = () => {} } = {}) {
  const all = [];
  for (const q of queries) {
    log(`Search: ${q}`);
    try {
      const r = await tavilySearch(q);
      all.push(...r);
      log(`  → ${r.length} results`);
    } catch (err) {
      log(`  → ${err.message}`);
    }
    await sleep(500);
  }
  return all;
}
