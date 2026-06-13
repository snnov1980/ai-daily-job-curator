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
  model: process.env.CLAUDE_MODEL || "claude-opus-4-8",

  // Gmail SMTP (nodemailer)
  gmailUser: required("GMAIL_USER"),
  gmailAppPassword: required("GMAIL_APP_PASSWORD"),

  // Where to send the digest (defaults to the sending Gmail account)
  mailTo: process.env.MAIL_TO || process.env.GMAIL_USER,

  // Only email jobs scoring at or above this (1-10). Mirrors the UI's minScore.
  minScore: Number(process.env.MIN_SCORE || 6),

  // Max jobs to include in the email (after sorting by score desc).
  maxJobs: Number(process.env.MAX_JOBS || 25),

  // If true, skip sending the email and just print the result to the console.
  dryRun: process.env.DRY_RUN === "true",
};
