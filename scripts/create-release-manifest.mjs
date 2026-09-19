import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(process.cwd());
const dist = resolve(root, "dist");
const productionProject = "articton-57fd8";

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat().sort();
}

async function digest(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

const distFiles = await walk(dist);
if (!distFiles.some((path) => path.endsWith("index.html"))) throw new Error("dist/index.html is missing; run the tested production build first.");
const files = [];
let totalBytes = 0;
for (const path of distFiles) {
  const info = await stat(path);
  totalBytes += info.size;
  files.push({ path: relative(root, path).replaceAll("\\", "/"), bytes: info.size, sha256: await digest(path) });
}
const protectedFiles = ["firebase.json", "firestore.rules", "firestore.indexes.json", "storage.rules", "functions/index.js", "functions/package-lock.json"];
const inputs = {};
for (const path of protectedFiles) inputs[path] = await digest(resolve(root, path));
const manifest = {
  schemaVersion: 1,
  projectId: productionProject,
  createdAt: new Date().toISOString(),
  gitCommit: process.env.GIT_COMMIT || "working-tree",
  totalBytes,
  fileCount: files.length,
  inputs,
  files,
};
await writeFile(resolve(root, "release-artifact.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Recorded ${files.length} release files (${totalBytes} bytes) for ${productionProject}.`);
