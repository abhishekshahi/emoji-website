const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname);
const source = path.join(root, "phase-8-50-verify.source.ts");
const target = path.join(root, "phase-8-50-verify.ts");
const b64Path = path.join(root, "._b64.tmp");
const ps1 = path.join(root, "._write.ps1");

const content = fs.readFileSync(source, "utf8");
fs.writeFileSync(b64Path, Buffer.from(content, "utf8").toString("base64"), "utf8");

const psContent = [
  "$utf8 = New-Object System.Text.UTF8Encoding $false",
  `$b64 = [System.IO.File]::ReadAllText('${b64Path.replace(/\\/g, "/")}', $utf8).Trim()`,
  "$bytes = [Convert]::FromBase64String($b64)",
  "$c = $utf8.GetString($bytes)",
  `[System.IO.File]::WriteAllText('${target.replace(/\\/g, "/")}', $c, $utf8)`,
  `Remove-Item '${b64Path.replace(/\\/g, "/")}' -Force`,
  `Remove-Item '${ps1.replace(/\\/g, "/")}' -Force`,
  "Write-Host 'Written phase-8-50-verify.ts'",
].join("\n");

fs.writeFileSync(ps1, psContent, "utf8");
execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`, { stdio: "inherit" });
