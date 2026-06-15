import nodemailer from "nodemailer";
import { config } from "./config.js";

const NAVY = "#1B3A6B";
const ACCENT = "#2E75B6";

const VERDICT_COLOR = {
  "Strong Match": "#10B981",
  "Good Match": "#3B82F6",
  "Partial Match": "#F59E0B",
  "Poor Match": "#EF4444",
};

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function scoreColor(score) {
  return score >= 7 ? "#10B981" : score >= 5 ? "#F59E0B" : "#EF4444";
}

function jobCard(job, rank) {
  const verdict = job.verdict || "Partial Match";
  const badge = VERDICT_COLOR[verdict] || VERDICT_COLOR["Partial Match"];
  const sc = scoreColor(job.score || 0);
  const tags = [];
  if (job.tier && job.tier !== "Other") tags.push(job.tier);
  if (job.domain_match) tags.push("✓ BFSI");
  if (job.seniority_match) tags.push("✓ Senior");
  if (job.source) tags.push(job.source);

  const matched = (job.matched_skills || []).slice(0, 8);
  const missing = (job.missing_skills || []).slice(0, 6);

  // Verification badge: green = confirmed open, amber = couldn't verify (check first).
  const status = String(job.status || "").toLowerCase();
  const statusBadge =
    status === "open"
      ? `<span style="background:#D1FAE5;color:#065F46;border-radius:4px;padding:3px 8px;font-size:11px;margin-left:4px;">✓ Verified open</span>`
      : status === "unknown"
        ? `<span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:3px 8px;font-size:11px;margin-left:4px;">⚠ Unverified — confirm before applying</span>`
        : "";

  return `
  <tr><td style="padding:0 0 14px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
      <tr><td style="padding:14px 16px;background:#F8FAFC;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:46px;vertical-align:top;">
            <div style="background:${NAVY};color:#fff;border-radius:6px;width:24px;height:24px;line-height:24px;text-align:center;font-size:12px;font-weight:bold;margin-bottom:6px;">${rank}</div>
            <div style="border:3px solid ${sc};border-radius:50%;width:34px;height:34px;line-height:34px;text-align:center;font-size:14px;font-weight:bold;color:${sc};">${esc(job.score ?? "?")}</div>
          </td>
          <td style="vertical-align:top;padding-left:8px;">
            <div style="font-size:15px;font-weight:bold;color:#111827;">${esc(job.title)}</div>
            <div style="font-size:13px;color:#6B7280;margin-top:2px;">${esc(job.company)} · ${esc(job.location)}${job.posted ? ` · 🕒 ${esc(job.posted)}` : ""}</div>
            <div style="margin-top:8px;">
              <span style="background:${badge};color:#fff;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:bold;">${esc(verdict)}</span>
              ${statusBadge}
              ${tags
                .map(
                  (t) =>
                    `<span style="background:#EDE9FE;color:#6D28D9;border-radius:4px;padding:3px 8px;font-size:11px;margin-left:4px;">${esc(t)}</span>`,
                )
                .join("")}
            </div>
          </td>
          <td style="vertical-align:top;text-align:right;width:90px;">
            ${
              job.url && job.url !== "N/A"
                ? `<a href="${esc(job.url)}" style="background:${ACCENT};color:#fff;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:bold;text-decoration:none;">Apply →</a>`
                : ""
            }
          </td>
        </tr></table>
        ${
          job.snippet
            ? `<div style="font-size:13px;color:#374151;margin-top:10px;line-height:1.5;">${esc(job.snippet)}</div>`
            : ""
        }
        ${
          job.why_apply
            ? `<div style="margin-top:10px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;padding:8px 10px;font-size:12px;color:#1E40AF;"><b>💡 Why apply:</b> ${esc(job.why_apply)}</div>`
            : ""
        }
        ${
          matched.length
            ? `<div style="margin-top:8px;font-size:11px;color:#065F46;"><b>Matched:</b> ${matched.map(esc).join(", ")}</div>`
            : ""
        }
        ${
          missing.length
            ? `<div style="margin-top:4px;font-size:11px;color:#991B1B;"><b>Gaps:</b> ${missing.map(esc).join(", ")}</div>`
            : ""
        }
        ${
          (job.red_flags || []).length
            ? `<div style="margin-top:6px;background:#FEF9C3;border:1px solid #FDE047;border-radius:6px;padding:6px 10px;font-size:11px;color:#854D0E;"><b>⚠ Flags:</b> ${job.red_flags.map(esc).join(" · ")}</div>`
            : ""
        }
      </td></tr>
    </table>
  </td></tr>`;
}

export function buildHtml({ today, jobs }) {
  const strong = jobs.filter((j) => j.verdict === "Strong Match").length;
  const good = jobs.filter((j) => j.verdict === "Good Match").length;
  const avg = jobs.length
    ? (jobs.reduce((a, b) => a + (b.score || 0), 0) / jobs.length).toFixed(1)
    : "0";

  const stat = (label, val, color) => `
    <td style="text-align:center;padding:6px 14px;">
      <div style="font-size:20px;font-weight:bold;color:${color};">${val}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.8);">${label}</div>
    </td>`;

  const cards = jobs.length
    ? jobs.map((j, i) => jobCard(j, i + 1)).join("")
    : `<tr><td style="padding:40px;text-align:center;color:#94A3B8;">No jobs matched your filters today. Try lowering MIN_SCORE.</td></tr>`;

  return `<!DOCTYPE html><html><body style="margin:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px;">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;">
      <tr><td style="background:${NAVY};border-radius:12px 12px 0 0;padding:22px 24px;">
        <div style="font-size:20px;font-weight:bold;color:#fff;">🤖 Daily Job Curator</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">${esc(today)} · BFSI &amp; SDET roles · Hyderabad / Bengaluru / Pune</div>
        <table cellpadding="0" cellspacing="0" style="margin-top:14px;background:rgba(255,255,255,0.12);border-radius:8px;"><tr>
          ${stat("Total", jobs.length, "#93C5FD")}
          ${stat("Strong", strong, "#6EE7B7")}
          ${stat("Good", good, "#FDE68A")}
          ${stat("Avg Score", avg, "#C4B5FD")}
        </tr></table>
      </td></tr>
      <tr><td style="background:#F1F5F9;padding:18px;">
        <table width="100%" cellpadding="0" cellspacing="0">${cards}</table>
        <div style="text-align:center;font-size:11px;color:#94A3B8;margin-top:10px;">
          Generated by AI Daily Job Curator · sorted by match score (highest first)
        </div>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

export async function sendEmail({ today, jobs }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: config.gmailUser, pass: config.gmailAppPassword },
  });

  const subject = jobs.length
    ? `🎯 ${jobs.length} job matches today (${jobs.filter((j) => j.verdict === "Strong Match").length} strong) — ${today}`
    : `Daily Job Curator — no new matches today (${today})`;

  await transporter.sendMail({
    from: `"AI Job Curator" <${config.gmailUser}>`,
    to: config.mailTo,
    subject,
    html: buildHtml({ today, jobs }),
  });
}
