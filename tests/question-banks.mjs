import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestions, assertCurrentRevision, snapshotQuestionBank, EDITABLE_ASSESSMENTS } from '../src/utils/questionBankModel.js';
import { MOBILE_QUESTION_DEFAULTS } from '../src/data/mobileQuestionDefaults.js';

const question = () => ({ text: 'Which tool?', options: ['Screwdriver', 'Hammer'], correctAnswerIndex: 0, explanation: 'Use the appropriate screwdriver.' });
test('all ten mobile assessment IDs are available', () => {
  assert.equal(EDITABLE_ASSESSMENTS.length, 10);
  assert.equal(new Set(EDITABLE_ASSESSMENTS.map((item) => item.id)).size, 10);
  assert.ok(EDITABLE_ASSESSMENTS.some((item) => item.id === 'module_4_post_test'));
  assert.ok(EDITABLE_ASSESSMENTS.some((item) => item.id === 'practice_exam_2'));
});
test('all copied mobile defaults are valid and cover every assessment', () => {
  assert.deepEqual(Object.keys(MOBILE_QUESTION_DEFAULTS).sort(), EDITABLE_ASSESSMENTS.map((item) => item.id).sort());
  assert.equal(Object.values(MOBILE_QUESTION_DEFAULTS).reduce((total, questions) => total + validateQuestions(questions).length, 0), 241);
});
test('questions require text, two to four choices, a valid answer, and explanation', () => {
  for (const change of [{ text: ' ' }, { options: ['Only one'] }, { options: ['a','b','c','d','e'] }, { options: ['', 'b'] }, { options: ['Same', 'same'] }, { correctAnswerIndex: -1 }, { correctAnswerIndex: 2 }, { correctAnswerIndex: 0.5 }, { explanation: '' }]) {
    assert.throws(() => validateQuestions([{ ...question(), ...change }]));
  }
  assert.equal(validateQuestions([question()]).length, 1);
});
test('stale requests and already reviewed requests cannot publish', () => {
  assert.throws(() => assertCurrentRevision({ status: 'pending', baseRevision: 1 }, { revision: 2 }));
  assert.throws(() => assertCurrentRevision({ status: 'approved', baseRevision: 2 }, { revision: 2 }));
  assert.equal(assertCurrentRevision({ status: 'pending', baseRevision: 2 }, { revision: 2 }), 2);
  assert.equal(assertCurrentRevision({ status: 'pending', baseRevision: 0 }, null), 0);
});
test('active attempt snapshots survive bank updates and cannot be mutated', () => {
  const bank = { revision: 1, questions: [question()] };
  const active = snapshotQuestionBank(bank);
  bank.questions[0].text = 'Updated question';
  bank.questions[0].options[0] = 'Updated choice';
  bank.revision = 2;
  assert.equal(active.revision, 1);
  assert.equal(active.questions[0].text, 'Which tool?');
  assert.equal(active.questions[0].options[0], 'Screwdriver');
  assert.throws(() => { active.questions[0].correctAnswerIndex = 1; });
  assert.equal(snapshotQuestionBank(bank).revision, 2);
  assert.throws(() => snapshotQuestionBank({ revision: 0, questions: [] }));
});
