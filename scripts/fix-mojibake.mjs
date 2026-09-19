import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const replacements = new Map([
  ["â†’", "→"],
  ["â†", "←"],
  ["â†º", "↺"],
  ["âœ“", "✓"],
  ["âœ•", "✕"],
  ["â–¾", "▾"],
  ["â€¢", "•"],
  ["â€”", "—"],
  ["â€¦", "…"],
  ["â˜…", "★"],
  ["Â·", "·"],
  ["â”€", "─"],
]);

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(filePath);
      continue;
    }
    if (!/\.(?:js|jsx|css)$/.test(entry.name)) continue;

    const before = fs.readFileSync(filePath, "utf8");
    let after = before;
    for (const [broken, correct] of replacements) after = after.split(broken).join(correct);
    if (after !== before) fs.writeFileSync(filePath, after, "utf8");
  }
}

visit(sourceRoot);
