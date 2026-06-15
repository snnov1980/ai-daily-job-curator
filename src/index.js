import { config } from "./config.js";
import { curate } from "./curator.js";
import { sendEmail, buildHtml } from "./email.js";

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function main() {
  log(
    `Starting curation — provider=${config.searchProvider}, rate=${config.rateModel}, ` +
      `verify=${config.verifyPostings}, minScore=${config.minScore}`,
  );

  const { today, jobs } = await curate({ log });

  if (config.dryRun) {
    log(`DRY_RUN: would email ${jobs.length} jobs to ${config.mailTo}`);
    for (const [i, j] of jobs.entries()) {
      log(`  ${i + 1}. [${j.score}] ${j.title} @ ${j.company} (${j.verdict})`);
    }
    // Write the HTML so you can preview it in a browser.
    const { writeFileSync } = await import("node:fs");
    writeFileSync("preview.html", buildHtml({ today, jobs }));
    log("Wrote preview.html — open it in a browser to see the email.");
    return;
  }

  await sendEmail({ today, jobs });
  log(`Sent digest with ${jobs.length} jobs to ${config.mailTo}`);
}

main().catch((err) => {
  console.error("Job curator failed:", err);
  process.exit(1);
});
