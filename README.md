# AI Daily Job Curator

A headless service that, once a day:

1. Uses the **free Tavily Search API** to find jobs on **LinkedIn** and **Naukri.com**, then Claude (Haiku) to verify each is live and rate it against your profile,
2. Rates each job 1–10 against your profile (domain, seniority, skills, company tier),
3. Emails you a digest **sorted highest-match-first** via Gmail.

It runs automatically on **GitHub Actions** — no server to keep on, secrets stored securely.

```
src/
  profile.js   ← your profile, search queries, and rating prompts (edit this to tune results)
  config.js    ← reads env vars / secrets
  search.js    ← free Tavily Search API client (the default search provider)
  curator.js   ← search → verify → rate → filter → sort (Tavily + Anthropic SDK)
  email.js     ← renders the HTML digest and sends via Gmail SMTP
  index.js     ← entry point
.github/workflows/daily-job-curator.yml  ← daily cron schedule
job_alert_ai_1.jsx  ← the original React UI (optional live dashboard; not used by the service)
```

---

## 1. One-time setup

### a) Gmail App Password (for sending the email)

1. Enable **2-Step Verification** on `snnov1980@gmail.com` (required).
2. Go to https://myaccount.google.com/apppasswords → create an app password (name it "Job Curator").
3. Copy the 16-character password (no spaces). This is your `GMAIL_APP_PASSWORD` — **not** your Gmail login password.

### b) Anthropic API key

Get one at https://console.anthropic.com/settings/keys. This is your `ANTHROPIC_API_KEY`.

### c) Tavily Search API key (free — keeps search cost at $0)

The default search provider is **Tavily** (`SEARCH_PROVIDER=tavily`), which replaces
Claude's paid `web_search` with Tavily's free tier (~1,000 searches/month, **no
credit card**).

1. Sign up at https://app.tavily.com/ (free "Researcher" plan).
2. Copy your API key (starts with `tvly-`) → this is your `TAVILY_API_KEY`.

> Prefer no extra key? Set `SEARCH_PROVIDER=claude` to use Claude's built-in web
> search instead (no Tavily key needed, but ~$10 per 1,000 searches).

---

## 2. Test locally first

```bash
npm install
cp .env.example .env        # then edit .env with your real keys
npm run dry-run             # searches + rates, but does NOT email; writes preview.html
```

Open `preview.html` in a browser to see exactly what the email will look like.
When you're happy, send a real test email to yourself:

```bash
node --env-file=.env src/index.js
```

> Local runs need Node 22+ (you have v22.14.0). The `--env-file` flag loads `.env`.

---

## 3. Deploy to GitHub Actions (the daily service)

1. Create a GitHub repo and push this folder:
   ```bash
   git init && git add . && git commit -m "AI daily job curator"
   git branch -M main
   git remote add origin https://github.com/<you>/ai-daily-job-curator.git
   git push -u origin main
   ```
   (`.env` and `node_modules` are gitignored — only code is pushed.)

2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**. Add:

   | Secret name           | Value                                  |
   | --------------------- | -------------------------------------- |
   | `ANTHROPIC_API_KEY`   | your Anthropic key                     |
   | `TAVILY_API_KEY`      | your free Tavily Search key            |
   | `GMAIL_USER`          | `<Your email address here>`            |
   | `GMAIL_APP_PASSWORD`  | the 16-char Gmail app password         |
   | `MAIL_TO`             | `<Your email address here>`            |

3. **Test it now:** go to the **Actions** tab → *Daily Job Curator* → **Run workflow**. You should get an email within a few minutes.

4. From then on it runs automatically **every day at 08:00 IST** (02:30 UTC). Change the time by editing the `cron` line in `.github/workflows/daily-job-curator.yml` (use https://crontab.guru; remember it's UTC).

---

## 4. Tuning

All edits live in two places:

- **`src/profile.js`** — your profile text, the `SEARCH_QUERIES` list, and the rating rubric. This is the main thing to tweak to change what gets found and how it's scored.
- **Environment variables** (`.env` locally, or GitHub secrets):
  - `MIN_SCORE` (default `6`) — only email jobs scoring at/above this. **Lower to `5` if you want more jobs.**
  - `MAX_JOBS` (default `25`) — cap on jobs per email.
  - `MAX_POSTED_DAYS` (default `14`) — drop postings older than this when the date is known.
  - **Quality / cost:**
    - `SEARCH_PROVIDER` (default `tavily`) — `tavily` (free search API) or `claude` (paid built-in search).
    - `TAVILY_API_KEY` — required when `SEARCH_PROVIDER=tavily`.
    - `SEARCH_COUNT` (default `12`) — results fetched per query (raise for more jobs).
    - `SEARCH_DEPTH` (default `advanced`) — `advanced` (better results) or `basic` (cheaper/shallower).
    - `RATE_MODEL` (default `claude-sonnet-4-6`) — extraction + verification + scoring. `claude-haiku-4-5` for min cost, `claude-opus-4-8` for sharpest scoring.
    - `SEARCH_MODEL` (default `claude-haiku-4-5`) — search step for the `claude` provider only.
    - `CLAUDE_MODEL` — overrides both models at once.
    - `VERIFY_POSTINGS` (default `true`) — opens each posting to filter expired jobs. Unopenable ones are kept and labelled "Unverified".
    - `FETCH_MAX_TOKENS` (default `3000`) — tokens pulled per fetched page; lower = cheaper.
    - `MAX_SEARCH_USES` (default `3`) / `MAX_FETCH_USES` (default `4`) — per-query tool-call caps.

### Cost tiers at a glance

| Goal | Settings | Trade-off |
|---|---|---|
| **Cheapest (default)** | `SEARCH_PROVIDER=tavily` + Haiku | Free search; only a few cents of Haiku tokens per run |
| **Cheapest, no fetch** | Tavily + `VERIFY_POSTINGS=false` | Lowest possible; relies on Tavily's snippet, some stale jobs may slip through |
| **No extra key** | `SEARCH_PROVIDER=claude` | No Tavily signup, but ~$10/1,000 searches |
| **Best quality** | `RATE_MODEL=claude-sonnet-4-6` (or `claude-opus-4-8`) | Sharper scoring, higher token cost |

---

## Notes & limits

- **Cost:** with the default `tavily` provider, web search is **free** (within Tavily's ~1,000/month tier). The only cost is Claude tokens for verify + rate — a few cents per run on the default Sonnet rate model (less on Haiku). Switching to `SEARCH_PROVIDER=claude` adds ~$10/1,000 searches.
- **Job links:** Claude returns the real posting URLs it finds via web search. Occasionally a link may be stale (postings close); the digest shows the source (LinkedIn/Naukri) so you can verify.
- **No scraping:** this uses Claude's web-search tool, not direct scraping of LinkedIn/Naukri (which their terms restrict). Results depend on what the search surfaces.
- The original `job_alert_ai_1.jsx` is kept as an optional interactive dashboard. It will not work as-is in a browser (no API key, CORS); the service in `src/` is the working daily-email path.
