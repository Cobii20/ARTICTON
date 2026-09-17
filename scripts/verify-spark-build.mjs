import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}

const textFiles = (await files("dist")).filter((file) => /\.(?:html|js|css|json)$/i.test(file));
const forbidden = ["articton-57fd8.cloudfunctions.net", "sendEmailOtp", "verifyEmailOtp", "endOtpSession", "generativelanguage.googleapis.com"];
const findings = [];
for (const file of textFiles) {
  const contents = await readFile(file, "utf8");
  for (const token of forbidden) if (contents.includes(token)) findings.push(`${file}: ${token}`);
}
if (findings.length) {
  console.error(`Spark build contains forbidden backend references:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log("Spark build contains no known legacy Function, OTP, or direct Gemini endpoint references.");
