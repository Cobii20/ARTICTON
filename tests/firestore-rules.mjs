import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
let env;
before(async () => {
 env = await initializeTestEnvironment({projectId:'demo-articton',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(async c => {
  for (const role of ['student','faculty','admin']) await setDoc(doc(c.firestore(),'users',role),{uid:role,email:`${role}@example.com`,role,firstName:role,lastName:'Test'});
  await setDoc(doc(c.firestore(),'users/student/quizScores/legacy'),{score:8,total:10});
  await setDoc(doc(c.firestore(),'module_content_cards/card'),{moduleId:'module_1',title:'Test'});
 });
});
after(async () => { await env?.cleanup(); });
const db = (role) => env.authenticatedContext(role,{email:`${role}@example.com`}).firestore();
test('password user can read own profile without OTP',async()=>assertSucceeds(getDoc(doc(db('student'),'users/student'))));
test('signed out user cannot read profiles',async()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users/student'))));
test('student cannot read another profile or list users',async()=>{
 await assertFails(getDoc(doc(db('student'),'users/faculty')));
 await assertFails(getDocs(collection(db('student'),'users')));
});
test('faculty and administrator can load student lists',async()=>{
 for(const role of ['faculty','admin']) await assertSucceeds(getDocs(collection(db(role),'users')));
});
test('signup creates only an owned student profile',async()=>{
 const fresh=env.authenticatedContext('new',{email:'new@example.com'}).firestore();
 await assertFails(setDoc(doc(fresh,'users/other'),{uid:'other',role:'student'}));
 await assertFails(setDoc(doc(fresh,'users/new'),{uid:'new',role:'admin'}));
 await assertSucceeds(setDoc(doc(fresh,'users/new'),{uid:'new',email:'new@example.com',role:'student'}));
});
test('profile edits work but role escalation is denied',async()=>{
 await assertSucceeds(updateDoc(doc(db('student'),'users/student'),{firstName:'Updated',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(db('student'),'users/student'),{role:'admin'}));
});
test('progress and scores save only under the owner',async()=>{
 await assertSucceeds(updateDoc(doc(db('student'),'users/student'),{moduleProgress:{module1:{percent:10}}}));
 await assertSucceeds(setDoc(doc(db('student'),'users/student/module_scores/test'),{score:8,total:10}));
 await assertFails(setDoc(doc(db('student'),'users/faculty/module_scores/test'),{score:8,total:10}));
});
test('legacy mobile results can be read by owner and staff only',async()=>{
 for(const role of ['student','faculty','admin']) await assertSucceeds(getDocs(collection(db(role),'users/student/quizScores')));
 await assertFails(getDocs(collection(db('new'),'users/student/quizScores')));
});
test('module content is readable after login and writable only by admin',async()=>{
 await assertSucceeds(getDocs(collection(db('student'),'module_content_cards')));
 await assertFails(updateDoc(doc(db('student'),'module_content_cards/card'),{title:'Altered'}));
 await assertSucceeds(updateDoc(doc(db('admin'),'module_content_cards/card'),{title:'Reviewed'}));
});
test('answer keys and obsolete OTP documents remain private',async()=>{
 for(const path of ['assessment_answer_keys/test','otp_sessions/student','otp_challenges/student']) await assertFails(getDoc(doc(db('student'),path)));
});
test('support request accepts authenticated user payload',async()=>{
 const ticket = doc(db('student'),'supportTickets/test-ticket');
 await assertSucceeds(setDoc(ticket,{name:'Student Test',email:'student@example.com',subject:'Test',message:'Test message',screenshotURL:'',status:'open',createdAt:serverTimestamp()}));
 await assertFails(getDoc(ticket));
 await assertFails(updateDoc(ticket,{status:'resolved'}));
 await assertSucceeds(getDoc(doc(db('admin'),'supportTickets/test-ticket')));
 await assertSucceeds(updateDoc(doc(db('admin'),'supportTickets/test-ticket'),{status:'in_progress'}));
 await assertSucceeds(updateDoc(doc(db('admin'),'supportTickets/test-ticket'),{status:'resolved'}));
 await assertFails(updateDoc(doc(db('admin'),'supportTickets/test-ticket'),{subject:'Changed'}));
});
