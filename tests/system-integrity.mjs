import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.(?:js|jsx|css)$/.test(entry.name) ? [target] : [];
  });
}

test("application source contains no known mojibake markers", () => {
  const failures = sourceFiles(path.join(root, "src"))
    .filter((file) => /[âÂÃ�]/u.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));
  assert.deepEqual(failures, []);
});

test("practice tests use top-level application routes", () => {
  const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "src/PAGES/Dashboard.jsx"), "utf8");
  for (const id of [
    "amd-full-assembly-practical",
    "amd-full-disassembly-practical",
    "intel-full-assembly-practical",
    "intel-full-disassembly-practical",
  ]) {
    assert.match(app, new RegExp(`page === ["']${id}["']`));
  }
  assert.match(dashboard, /onOpenPractical\?\.\(test\.id\)/);
});
