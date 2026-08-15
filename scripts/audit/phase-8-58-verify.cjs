const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..", "..");
const exportDir = path.join(root, "r2-export");
const CONFIG = path.join(root, "src/lib/master/integration/config.ts");
const PROD = "https://emojiquick.com";

function patch(flags) {
  let c = fs.readFileSync(CONFIG, "utf8");
  for (const [k, v] of Object.entries(flags)) {
    c = c.replace(new RegExp(`${k}:\\s*(true|false)`), `${k}: ${v}`);
  }
  fs.writeFileSync(CONFIG, c, "utf8");
}

function snapshot() {
  const c = fs.readFileSync(CONFIG, "utf8");
  return {
    masterMetadataEnabled: /masterMetadataEnabled:\s*true/.test(c),
    masterSearchEnabled: /masterSearchEnabled:\s*true/.test(c),
    masterArtworkEnabled: /masterArtworkEnabled:\s*true/.test(c),
    masterSEOEnabled: /masterSEOEnabled:\s*true/.test(c),
  };
}

async function probe(p) {
  const r = await fetch(PROD + p, { redirect: "manual" });
  return { path: p, status: r.status };
}

const original = snapshot();
const steps = [
  { label: "metadata", flags: { masterMetadataEnabled: true, masterSearchEnabled: false, masterArtworkEnabled: false, masterSEOEnabled: false } },
  { label: "search", flags: { masterMetadataEnabled: true, masterSearchEnabled: true, masterArtworkEnabled: false, masterSEOEnabled: false } },
  { label: "artwork", flags: { masterMetadataEnabled: true, masterSearchEnabled: true, masterArtworkEnabled: true, masterSEOEnabled: false } },
];

const log = [];
let ok = true;

(async () => {
for (const step of steps) {
  console.log("Rollout step:", step.label);
  patch(step.flags);
  try {
    execSync("npm run typecheck", { cwd: root, stdio: "pipe" });
    execSync("npx tsx --test src/lib/master/release/release.test.ts", { cwd: root, stdio: "pipe" });
    execSync("npm run build:cf", { cwd: root, stdio: "pipe", env: { ...process.env, MASTER_R2_MODE: "DATA_READY", MASTER_SEO_ROLLOUT_MODE: "OFF" } });
    execSync("npm run deploy:cf", { cwd: root, stdio: "pipe", env: { ...process.env, MASTER_R2_MODE: "DATA_READY", MASTER_SEO_ROLLOUT_MODE: "OFF" } });
    const probes = await Promise.all(["/", "/emoji/fire", "/search"].map(probe));
    const stepOk = probes.every((x) => x.status === 200);
    log.push({ step: step.label, ok: stepOk, probes });
    if (!stepOk) {
      ok = false;
      break;
    }
  } catch (e) {
    log.push({ step: step.label, ok: false, error: String(e.message || e) });
    ok = false;
    break;
  }
}

if (!ok) {
  patch({
    masterMetadataEnabled: original.masterMetadataEnabled,
    masterSearchEnabled: original.masterSearchEnabled,
    masterArtworkEnabled: original.masterArtworkEnabled,
    masterSEOEnabled: false,
  });
  execSync("npm run build:cf", { cwd: root, stdio: "pipe" });
  execSync("npm run deploy:cf", { cwd: root, stdio: "pipe", env: { ...process.env, MASTER_R2_MODE: "OFF", MASTER_SEO_ROLLOUT_MODE: "OFF" } });
  console.log("ROLLBACK to flags OFF");
} else {
  console.log("ROLLOUT complete — metadata/search/artwork enabled, SEO OFF");
}

fs.writeFileSync(path.join(exportDir, "phase-8.58-rollout.log"), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log));
process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
