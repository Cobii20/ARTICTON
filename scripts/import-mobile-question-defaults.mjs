import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileRoot = resolve(process.argv[2] || "../../Articton (Mobile)/articton_mobile/lib");
const assessments = [
  ...[1, 2, 3, 4].flatMap((module) => [
    [`module_${module}_pre_test`, `Modules/module_${module}/pre_test_page.dart`, "kPreTestQuestions"],
    [`module_${module}_post_test`, `Modules/module_${module}/post_test_page.dart`, "kPostTestQuestions"],
  ]),
  ["practice_exam_1", "content/practice_question_defaults.dart", "practiceExam1Questions"],
  ["practice_exam_2", "content/practice_question_defaults.dart", "practiceExam2Questions"],
];

function findMatching(source, start, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === open) depth += 1;
    else if (character === close && --depth === 0) return index;
  }
  throw new Error(`Unclosed ${open} at ${start}`);
}

function splitTopLevel(source) {
  const fields = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "(") round += 1;
    else if (character === ")") round -= 1;
    else if (character === "[") square += 1;
    else if (character === "]") square -= 1;
    else if (character === "," && round === 0 && square === 0) {
      fields.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const finalField = source.slice(start).trim();
  if (finalField) fields.push(finalField);
  return fields;
}

function decodeString(literal) {
  if (!/^(['"]).*\1$/s.test(literal)) throw new Error(`Unsupported Dart string: ${literal.slice(0, 40)}`);
  // These files contain trusted, non-interpolated Dart literals whose escaping
  // is compatible with JavaScript string literals.
  return Function(`"use strict"; return (${literal});`)();
}

function parseList(source, name) {
  const declaration = source.indexOf(name);
  if (declaration < 0) throw new Error(`Missing ${name}`);
  const listStart = source.indexOf("[", declaration);
  const listEnd = findMatching(source, listStart, "[", "]");
  const list = source.slice(listStart + 1, listEnd);
  const questions = [];
  let cursor = 0;
  while ((cursor = list.indexOf("Question(", cursor)) >= 0) {
    const open = list.indexOf("(", cursor);
    const close = findMatching(list, open, "(", ")");
    const fields = splitTopLevel(list.slice(open + 1, close));
    if (fields.length !== 4) throw new Error(`${name} question has ${fields.length} fields`);
    const optionsSource = fields[1].trim();
    const options = splitTopLevel(optionsSource.slice(1, -1)).map(decodeString);
    questions.push({
      text: decodeString(fields[0]),
      options,
      correctAnswerIndex: Number(fields[2]),
      explanation: decodeString(fields[3]),
    });
    cursor = close + 1;
  }
  if (!questions.length) throw new Error(`No questions found for ${name}`);
  return questions;
}

const defaults = {};
for (const [id, relativePath, variable] of assessments) {
  const source = await readFile(resolve(mobileRoot, relativePath), "utf8");
  defaults[id] = parseList(source, variable);
}

const output = `// Generated from the Flutter assessment defaults. Run npm run sync:questions after mobile defaults change.\nexport const MOBILE_QUESTION_DEFAULTS = ${JSON.stringify(defaults, null, 2)};\n`;
await mkdir(resolve("src/data"), { recursive: true });
await writeFile(resolve("src/data/mobileQuestionDefaults.js"), output, "utf8");
console.log(`Imported ${Object.values(defaults).reduce((total, list) => total + list.length, 0)} questions across ${assessments.length} assessments.`);
