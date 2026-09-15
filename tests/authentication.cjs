const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function loadFunctions(role = 'student') {
  const reads = [];
  const db = { doc(path) {
    reads.push(path);
    return { async get() { return { exists: path.startsWith('users/'), data: () => ({ role }) }; } };
  } };
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const context = {
    exports: {}, process: { env: {} }, console,
    require(name) {
      if (name === 'firebase-functions/v2/https') return { HttpsError, onCall: (...args) => args.at(-1) };
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
  for (const handler of Object.values(handlers)) {
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

test('administrator self-deletion remains blocked', async () => {
  const { handlers } = loadFunctions('admin');
  await assert.rejects(handlers.deleteStudentAccount({ auth, data: { uid: auth.uid } }), { code: 'failed-precondition' });
});

test('OTP endpoints are no longer exported', () => {
  const { handlers } = loadFunctions();
  for (const name of ['sendEmailOtp', 'verifyEmailOtp', 'endOtpSession']) assert.equal(handlers[name], undefined);
});
