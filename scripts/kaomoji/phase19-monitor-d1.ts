import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { EXPECTED_KAOMOJI, queryCount } from "@/lib/kaomoji/cloudflare/d1-import";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const logPath = join(rootDir, "phase19-d1-monitor.log");
const intervalMs = Number(process.env.PHASE19_MONITOR_INTERVAL_MS ?? 120_000);
const maxPolls = Number(process.env.PHASE19_MONITOR_MAX_POLLS ?? 0);

function log(line: string): void {
  const msg = `[${new Date().toISOString()}] ${line}\n`;
  process.stdout.write(msg);
  appendFileSync(logPath, msg, "utf8");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  mkdirSync(join(logPath, ".."), { recursive: true });
  log("D1 import monitor started");
  let polls = 0;
  let last = -1;
  while (true) {
    polls++;
    const count = queryCount(rootDir, "kaomoji", true);
    const rel = queryCount(rootDir, "relationship", true);
    const delta = count !== null && last >= 0 ? count - last : 0;
    last = count ?? last;
    log(
      `poll ${polls}: kaomoji=${count ?? "?"} (+${delta}) relationships=${rel ?? "?"} target=${EXPECTED_KAOMOJI}`,
    );
    if (count === EXPECTED_KAOMOJI && rel === 392904) {
      log("Import complete gate reached");
      process.exit(0);
    }
    if (maxPolls > 0 && polls >= maxPolls) {
      log("Max polls reached");
      process.exit(0);
    }
    await sleep(intervalMs);
  }
}

void main();
