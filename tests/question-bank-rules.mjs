import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, serverTimestamp, runTransaction, writeBatch } from 'firebase/firestore';

let env;
const assessmentId = 'module_1_pre_test';
const questions = [{ text: 'Question', options: ['A', 'B'], correctAnswerIndex: 0, explanation: 'Explanation' }];
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-articton-questions', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (context) => {
    for (const role of ['student', 'faculty', 'staff', 'admin', 'other']) await setDoc(doc(context.firestore(), 'users', role), { uid: role, role: role === 'other' ? 'faculty' : role });
  });
});
after(async () => { await env?.cleanup(); });
const db = (role) => env.authenticatedContext(role).firestore();
const request = (role, extra = {}) => ({ assessmentId, baseRevision: 0, questionCount: 1, before: questions, questions, summary: 'Fix wording\nand explanation', status: 'pending', requestedBy: role, createdAt: serverTimestamp(), reviewedBy: null, reviewedAt: null, ...extra });

test('faculty and staff submit requests but cannot publish directly', async () => {
  for (const role of ['faculty', 'staff']) {
    await assertSucceeds(setDoc(doc(db(role), 'question_change_requests', role), request(role)));
    await assertFails(setDoc(doc(db(role), 'published_question_banks', assessmentId), { questions, revision: 1 }));
  }
  await assertFails(setDoc(doc(db('student'), 'question_change_requests', 'student'), request('student')));
});
test('editors can query only their own requests and students cannot read requests', async () => {
  await assertSucceeds(getDocs(query(collection(db('faculty'), 'question_change_requests'), where('requestedBy', '==', 'faculty'))));
  await assertFails(getDocs(collection(db('faculty'), 'question_change_requests')));
  await assertFails(getDoc(doc(db('other'), 'question_change_requests', 'faculty')));
  await assertFails(getDoc(doc(db('student'), 'question_change_requests', 'faculty')));
  await assertSucceeds(getDocs(query(collection(db('admin'), 'question_change_requests'), where('status', '==', 'pending'))));
  await assertFails(getDoc(doc(db('student'), 'assessment_questions', 'legacy')));
  await assertSucceeds(getDoc(doc(db('faculty'), 'assessment_questions', 'legacy')));
});
test('forged ownership, baseline, status, count, and empty summary are rejected', async () => {
  for (const extra of [{ requestedBy: 'other' }, { before: [] }, { status: 'approved' }, { questionCount: 5 }, { summary: '  ' }, { baseRevision: 99 }]) {
    await assertFails(setDoc(doc(db('faculty'), 'question_change_requests', 'invalid'), request('faculty', extra)));
  }
});
test('approval must atomically publish matching questions at the next revision', async () => {
  const admin = db('admin');
  const changeRef = doc(admin, 'question_change_requests', 'faculty');
  const bankRef = doc(admin, 'published_question_banks', assessmentId);
  await assertFails(updateDoc(changeRef, { status: 'approved', reviewedBy: 'admin', reviewedAt: serverTimestamp() }));
  await assertSucceeds(runTransaction(admin, async (transaction) => {
    const change = (await transaction.get(changeRef)).data();
    await transaction.get(bankRef);
    transaction.set(bankRef, { questions: change.questions, revision: 1, sourceRequestId: 'faculty', approvedBy: 'admin', approvedAt: serverTimestamp() });
    transaction.update(changeRef, { status: 'approved', reviewedBy: 'admin', reviewedAt: serverTimestamp() });
  }));
  assert.equal((await getDoc(bankRef)).data().revision, 1);
  await assertSucceeds(getDoc(doc(db('student'), 'published_question_banks', assessmentId)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'published_question_banks', assessmentId)));
});
test('stale requests cannot overwrite a published revision, but can be rejected', async () => {
  const admin = db('admin');
  const bankRef = doc(admin, 'published_question_banks', assessmentId);
  const changeRef = doc(admin, 'question_change_requests', 'staff');
  const batch = writeBatch(admin);
  batch.set(bankRef, { questions, revision: 2, sourceRequestId: 'staff', approvedBy: 'admin', approvedAt: serverTimestamp() });
  batch.update(changeRef, { status: 'approved', reviewedBy: 'admin', reviewedAt: serverTimestamp() });
  await assertFails(batch.commit());
  await assertSucceeds(updateDoc(changeRef, { status: 'rejected', reviewedBy: 'admin', reviewedAt: serverTimestamp() }));
  assert.equal((await getDoc(bankRef)).data().revision, 1);
  await assertFails(updateDoc(changeRef, { status: 'approved', reviewedBy: 'admin', reviewedAt: serverTimestamp() }));
});
test('current revision publishes once and requests remain immutable', async () => {
  const faculty = db('faculty');
  await assertSucceeds(setDoc(doc(faculty, 'question_change_requests', 'next'), request('faculty', { baseRevision: 1, before: questions })));
  await assertFails(updateDoc(doc(faculty, 'question_change_requests', 'next'), { summary: 'Changed' }));
  const admin = db('admin');
  const batch = writeBatch(admin);
  batch.set(doc(admin, 'published_question_banks', assessmentId), { questions, revision: 2, sourceRequestId: 'next', approvedBy: 'admin', approvedAt: serverTimestamp() });
  batch.update(doc(admin, 'question_change_requests', 'next'), { status: 'approved', reviewedBy: 'admin', reviewedAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
});
