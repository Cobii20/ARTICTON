export function validateQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 100) {
    throw new Error("Provide between 1 and 100 questions.");
  }
  return questions.map((question, index) => {
    const fail = (message) => { throw new Error(`Question ${index + 1}: ${message}`); };
    if (typeof question?.text !== "string" || !question.text.trim()) fail("enter question text.");
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 4) fail("provide two to four choices.");
    if (question.options.some((option) => typeof option !== "string" || !option.trim())) fail("fill in every choice.");
    if (new Set(question.options.map((option) => option.trim().toLowerCase())).size !== question.options.length) fail("make every choice distinct.");
    if (!Number.isInteger(question.correctAnswerIndex) || question.correctAnswerIndex < 0 || question.correctAnswerIndex >= question.options.length) fail("select a correct answer.");
    if (typeof question.explanation !== "string" || !question.explanation.trim()) fail("enter an explanation.");
    return { text: question.text.trim(), options: question.options.map((option) => option.trim()), correctAnswerIndex: question.correctAnswerIndex, explanation: question.explanation.trim() };
  });
}

export function assertCurrentRevision(request, bank) {
  if (request.status !== "pending") throw new Error("This request has already been reviewed.");
  const revision = bank?.revision ?? 0;
  if (!Number.isInteger(revision) || revision < 0 || request.baseRevision !== revision) {
    throw new Error("A newer question bank has been published. Ask the editor to submit a new request based on the latest revision.");
  }
  return revision;
}

export function snapshotQuestionBank(bank) {
  if (!bank || !Number.isInteger(bank.revision) || bank.revision < 1) throw new Error("This assessment has no published question bank yet.");
  const questions = validateQuestions(bank.questions);
  for (const question of questions) { Object.freeze(question.options); Object.freeze(question); }
  return Object.freeze({ revision: bank.revision, questions: Object.freeze(questions) });
}
export const EDITABLE_ASSESSMENTS = [
  ...[1, 2, 3, 4].flatMap((module) => [
    { id: `module_${module}_pre_test`, title: `Module ${module} Pre-Test` },
    { id: `module_${module}_post_test`, title: `Module ${module} Post-Test` },
  ]),
  { id: "practice_exam_1", title: "Practice Exam 1" },
  { id: "practice_exam_2", title: "Practice Exam 2" },
];
