const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function loadFunctions(role = 'student', listedProfile = { role: 'student', firstName: 'Ada', lastName: 'Lovelace', avatarUrl: 'https://firebasestorage.googleapis.com/v0/b/articton/o/profile.jpg?alt=media', email: 'private@example.com', contactNumber: 'private' }) {
  const reads = [];
  const listedStudents = [
    { id: 'student-1', data: () => listedProfile },
  ];
  const db = { doc(path) {
    reads.push(path);
    return { async get() { return { exists: path.startsWith('users/'), data: () => ({ role }) }; } };
  }, collection(path) {
    reads.push(path);
    return {
      where() { return this; },
      limit() { return this; },
      async get() { return { docs: listedStudents }; },
    };
  } };
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const context = {
    exports: {}, process: { env: {} }, console, URL,
    require(name) {
      if (name === 'firebase-functions/v2/https') return { HttpsError, onCall: (...args) => args.at(-1) };
      if (name === 'firebase-functions/v2/firestore') return { onDocumentWritten: (...args) => args.at(-1) };
      if (name === 'firebase-admin') return { apps: [{}], firestore: () => db, auth: () => ({}) };
      if (name === './procedureNotes') return { PROCEDURE_DETAILS: {}, getProcedureText: () => 'Procedure' };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(readFileSync(new URL('../functions/index.js', `file://${__filename.replaceAll('\\', '/')}`), 'utf8'), context);
  return { handlers: context.exports, reads };
}
const auth = { uid: 'student-1', token: { email: 'student@example.com', auth_time: 1234 } };

test('every protected callable rejects requests without authentication', async () => {
  const { handlers, reads } = loadFunctions();
  for (const [name, handler] of Object.entries(handlers)) {
    if (name === 'syncStudentSummary') continue;
    await assert.rejects(handler({ data: {} }), { code: 'unauthenticated' });
  }
  assert.deepEqual(reads, []);
});

test('password-authenticated users reach assessment lookup without an OTP session', async () => {
  const { handlers, reads } = loadFunctions();
  await assert.rejects(handlers.startAssessment({ auth, data: { activityId: 'module-1' } }), { code: 'not-found' });
  assert.deepEqual(reads, ['assessment_definitions/module-1']);
});

test('students cannot call administrator account deletion', async () => {
  const { handlers, reads } = loadFunctions();
  await assert.rejects(handlers.deleteStudentAccount({ auth, data: { uid: 'other' } }), { code: 'permission-denied' });
  assert.deepEqual(reads, ['users/student-1']);
});

test('faculty can list minimal student summaries while students are denied', async () => {
  const faculty = loadFunctions('faculty', {
    role: 'student',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: 'https://firebasestorage.googleapis.com/v0/b/articton/o/profile.jpg?alt=media',
    email: 'private@example.com',
    contactNumber: 'private',
    quizProgress: {
      module1: { completed: true, score: 9, total: 10, privateNote: 'omit me' },
      unsupported: { completed: true },
    },
    mobileModuleScores: {
      module1Content: { completed: true, percent: 100 },
    },
  });
  const result = await faculty.handlers.listStudentSummaries({ auth, data: {} });
  assert.equal(result.students.length, 1);
  assert.equal(result.students[0].displayName, 'Ada Lovelace');
  assert.equal(result.students[0].avatarUrl, 'https://firebasestorage.googleapis.com/v0/b/articton/o/profile.jpg?alt=media');
  assert.equal(result.students[0].email, undefined);
  assert.equal(result.students[0].contactNumber, undefined);
  assert.equal(result.students[0].quizProgress.module1.score, 9);
  assert.equal(result.students[0].quizProgress.module1.privateNote, undefined);
  assert.equal(result.students[0].quizProgress.unsupported, undefined);
  assert.equal(result.students[0].mobileModuleScores.module1Content.percent, 100);

  const dataImage = 'data:image/png;base64,iVBORw0KGgo=';
  const dataImageFunctions = loadFunctions('faculty', { role: 'student', firstName: 'Grace', lastName: 'Hopper', avatarUrl: dataImage });
  const dataImageResult = await dataImageFunctions.handlers.listStudentSummaries({ auth, data: {} });
  assert.equal(dataImageResult.students[0].avatarUrl, dataImage);

  const student = loadFunctions('student');
  await assert.rejects(student.handlers.listStudentSummaries({ auth, data: {} }), { code: 'permission-denied' });
});

test('administrator self-deletion remains blocked', async () => {
  const { handlers } = loadFunctions('admin');
  await assert.rejects(handlers.deleteStudentAccount({ auth, data: { uid: auth.uid } }), { code: 'failed-precondition' });
});

test('OTP endpoints are no longer exported', () => {
  const { handlers } = loadFunctions();
  for (const name of ['sendEmailOtp', 'verifyEmailOtp', 'endOtpSession']) assert.equal(handlers[name], undefined);
});
