import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-articton',storage:{host:'127.0.0.1',port:9199,rules:readFileSync('storage.rules','utf8')}});});
after(async()=>{await env?.cleanup();});
test('support image uploads remain disabled until server-side byte validation exists',async()=>{
 const run=Date.now();
 const storage=env.authenticatedContext('student').storage('gs://articton-57fd8.firebasestorage.app');
 await assertFails(uploadBytes(ref(storage,`supportTickets/student/${run}.png`),new Uint8Array([1,2,3]),{contentType:'image/png'}));
 await assertFails(uploadBytes(ref(storage,'supportTickets/other/test.png'),new Uint8Array([1]),{contentType:'image/png'}));
 await assertFails(uploadBytes(ref(storage,'supportTickets/student/test.txt'),new Uint8Array([1]),{contentType:'text/plain'}));
 await assertFails(uploadBytes(ref(storage,'supportTickets/student/big.png'),new Uint8Array(5*1024*1024),{contentType:'image/png'}));
 await assertFails(getBytes(ref(env.unauthenticatedContext().storage('gs://articton-57fd8.firebasestorage.app'),`supportTickets/student/${run}.png`)));
});
test('clients cannot upload directly into validated profile photo paths',async()=>{
 const storage=env.authenticatedContext('student').storage('gs://articton-57fd8.firebasestorage.app');
 await assertFails(uploadBytes(ref(storage,'profile-photos/student/avatar.png'),new Uint8Array([1,2,3]),{contentType:'image/png'}));
});
