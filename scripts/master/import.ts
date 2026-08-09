import { runSourceAudit, verifySourceLock } from "./audit-sources";

const phase = process.argv[2] ?? "all";

async function main(): Promise<void> {
  console.log("EmojiFind Master Import Pipeline");
  console.log("================================");
  console.log("");

  if (phase === "all" || phase === "8.1" || phase === "audit") {
    console.log("[8.1] Source audit & version lock");
    verifySourceLock();
    runSourceAudit();
    console.log("");
  }

  if (phase === "all") {
    console.log("Phases 8.2–8.18 are not yet implemented.");
    console.log("Next: 8.2 Raw source ingestion");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
