import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error("Commit all changes before preparing an Alibaba source release.");
const revision = git("rev-parse", "HEAD");
const short = revision.slice(0, 12);
const output = resolve(root, ".tmp", "aliyun-source", revision);
mkdirSync(output, { recursive: true, mode: 0o700 });
const bundle = resolve(output, `lilly-meeting-platform-${short}.bundle`);
execFileSync("git", ["bundle", "create", "--quiet", bundle, "--all"], { cwd: root, stdio: "ignore" });
execFileSync("git", ["bundle", "verify", bundle], { cwd: root, stdio: "ignore" });
const sha256 = createHash("sha256").update(readFileSync(bundle)).digest("hex");
const manifest = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  revision,
  defaultBranch: "main",
  bundle: bundle.split("/").pop(),
  sha256,
  destination: `oss://lilly-meetings-backup-84650271/source-repositories/lilly-meeting-platform/${revision}/`,
};
const manifestPath = resolve(output, "manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ bundle, manifest: manifestPath, revision, sha256 }, null, 2));
