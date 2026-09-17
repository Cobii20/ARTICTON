# ARTICTON Firebase security and deployment review

## Safety status

No live resource was deployed, deleted, migrated, or reconfigured during this work. The checked-in rule and Function changes are review candidates only. Do not deploy them until the client migration items below are completed and emulator tests pass.

## Verified inventory (17 September 2026)

- Active CLI target: `articton-57fd8`; signed-in account was available to the audit.
- Firestore: Standard edition, `nam5`, free tier flag present, PITR off, database deletion protection off.
- Hosting: classic Firebase Hosting; the production build contains about 529.4 MB across 40 files.
- Storage: `articton-57fd8.firebasestorage.app`. Current Firebase policy requires Blaze for Cloud Storage access; it is not a Spark-compatible feature.
- Deployed generation-2 Functions: retained `deleteStudentAccount`, `submitAssessment`, `askModuleTutor`, and `startAssessment`; obsolete but still live `sendEmailOtp`, `verifyEmailOtp`, and `endOtpSession`. Local source removal does not disable deployed endpoints.
- Gemini: `askModuleTutor` has a server secret and is billable/usage-sensitive when enabled.
- No extensions or scheduled Functions were found in the repository configuration. Google Cloud inventory outside the Firebase CLI-visible resources was not fully inspectable.
- Billing plan was not conclusively verified. Deployed Functions imply Blaze was required when deployed, but are not proof of the project's present billing state.

## Finding status

| Finding | Status in repository | Production action still required |
| --- | --- | --- |
| Callable authentication/authorization | Hardened | Deploy after staging tests. |
| App Check | Client production initialization added; callable enforcement is controlled by `ENFORCE_APP_CHECK` | Register reCAPTCHA Enterprise, deploy with enforcement off, verify metrics/tokens, then set true and redeploy. Never ship debug tokens. |
| Distributed rate limiting | Firestore-transaction limits added for tutor, account deletion, assessments, and practical attempts | Add TTL policy to `function_rate_limits.expiresAt`; deploy and load-test. TTL deletion is not immediate and limits remain application-level controls. |
| Tutor abuse/cost | 800-character request, bounded context/history, 5/minute and 50/day, 12-second upstream timeout, 240 output tokens, no retry, server enable switch, max two instances | Configure `GEMINI_TUTOR_ENABLED`; monitor Gemini quota/cost. |
| Function scaling | `minInstances: 0`, max 5 (tutor 2), concurrency 10 (tutor 5), 256 MiB, 20–30 second timeouts | Review latency and 429 behavior. These are cost controls, not a guaranteed charge ceiling. |
| Official quiz scoring | Server snapshot grading retained; schemas and idempotent transaction tightened | Client must use `startAssessment`/`submitAssessment`; deploy rules and Functions together after emulator tests. |
| Practical scoring | Server-owned start/final timestamps and idempotent finalization endpoints added; score formula is 100 minus capped sequence/time deductions, pass at 75 | The four practical UIs still need wiring to these endpoints before hardened rules can ship. Client-reported 3D actions cannot be cryptographically proven by server storage. |
| Browser-forged legacy progress/achievements | Hardened rules reject direct official writes | Existing module/practical direct writes must be migrated to navigation-only state and server operations before rule deployment. |
| Profile privacy | Faculty access to private `users` documents removed; `student_summaries` boundary added | Populate summaries with a reviewed Admin SDK migration and update faculty query. Do not deploy first or faculty lists will fail. |
| Profile photos | Validated destination is no longer client-writable/readable by everyone | Backend quarantine, bounded decode/re-encode, token cleanup, and UI migration remain required. Upload UI must remain disabled in Spark. Existing download tokens are not revoked by rules. |
| Support uploads | Reduced to 2 MiB, exact image MIME set, safe filename, owner-only reads, no update/delete | MIME is not byte validation. Add the same quarantine/re-encode pipeline before treating attachments as trusted. |
| Rules validation | Profile/signup/ticket field lists and length limits added; official subcollections server-only | Java emulator run is still mandatory. Java installation was attempted but the installer was cancelled. |
| CSP/headers | Enforcing CSP plus existing headers prepared | Browser-test Auth, reCAPTCHA/App Check, YouTube, 3D assets, workers, and decoders on a preview channel before production. |
| Dependencies | Root production audit previously returned zero | Functions still have transitive moderate advisories. Admin SDK 14 conflicts with the current Functions peer range, so the attempted forced upgrade was rejected; select a supported SDK pair and regression-test it. |
| Environment files | `.env` and `.env.*` ignored, safe examples retained | Rotate any secret that was ever committed or exposed; Git status found no tracked local env files. |
| Database deletion protection | Currently disabled | Review then run `gcloud firestore databases update --database='(default)' --delete-protection` against the explicitly selected production project. This protects database deletion, not document deletion. |
| Hosting size | Confirmed 529,394,255 bytes | Asset optimization is unresolved. Preserve GLB node names/animations and run visual/interaction regression tests before replacing duplicates. |

## Largest Hosting files

`CpuAMD(Base).glb` and `NEWcpuAMD.glb` are about 96 MB each; three case variants are about 42 MB each; `pc.glb` is about 30.6 MB; duplicated AMD and Intel motherboard variants range from about 17–24 MB. At 529.4 MB per release, roughly 18 retained full releases can approach the Spark 10 GB Hosting storage quota. A cold visit that exercises all models can transfer hundreds of MB; immutable caching helps repeat visits but does not reduce first-load transfer. Route-level model loading is already more important than JavaScript chunking, though the 2.77 MB JS bundle should also be split.

## Spark versus full backend

| Capability | Separate Spark project | Full Blaze project |
| --- | --- | --- |
| Static lessons and local 3D interaction | Available | Available |
| Email/password authentication | Available within Auth quotas | Available; usage limits apply |
| Firestore | Available within daily Spark quotas | Pay-as-you-go beyond no-cost quota |
| Cloud Storage uploads | Disabled | Available and billable; use server validation |
| Cloud Functions and Gemini tutor | Disabled | Available and potentially billable |
| Official assessment submission/results | Disabled without trusted backend | Server-authoritative endpoints |
| Official achievements/practical records | Disabled; local feedback must say unverified | Server-issued, with documented 3D action trust limitation |
| Privileged administration | Disabled | Available with server authorization |

Spark requires no payment method, and over-quota products are normally paused rather than billed. It is not a promise of uninterrupted availability. Classic Hosting includes 10 GB storage and 360 MB/day transfer on Spark; Firestore includes daily read/write/delete limits. Cloud Storage for Firebase requires Blaze for current buckets. Linking a billing account upgrades a project to Blaze.

## Safe Spark procedure (review only)

1. Create a separate Firebase project and confirm its console says Spark. Do not reuse `articton-57fd8`.
2. Copy `.env.spark.example` to untracked `.env.spark`, fill only that project's public web-app configuration, and keep `VITE_FIREBASE_DEPLOYMENT_MODE=spark`.
3. Set `FIREBASE_SPARK_PROJECT_ID`, run `npm run deploy:spark:check`, `npm run build:spark`, and `npm run verify:spark`.
4. Preview locally and verify no Function, Storage, Gemini, OTP, official submission, achievement issuance, or admin network request occurs.
5. Deploy Hosting only with an explicit project: `firebase deploy --config firebase.spark.json --only hosting --project <verified-spark-project-id>`.
6. Roll back in Firebase Hosting release history or run `firebase hosting:rollback --project <verified-spark-project-id>` if supported by the installed CLI.

The build deliberately fails when the Spark project ID is missing or equals the existing ARTICTON project.

## Full-backend rollout (review only)

1. Complete the client migrations noted above and install Java 21.
2. Start only local emulators and run `npm test`, `npm run test:rules`, Function tests, production build, lint, and browser regressions.
3. Create a non-production Firebase project and deploy there first. Register App Check and initially leave `ENFORCE_APP_CHECK=false`.
4. Deploy explicitly and separately: Functions, then Firestore rules/indexes, then Storage rules, then Hosting. Inspect each diff and target before confirming.
5. Verify legitimate student/faculty/admin workflows and rejected cross-user/forged/oversized/concurrent requests. Then enable App Check enforcement and repeat.
6. For production, use `firebase deploy --only functions --project articton-57fd8`, `firebase deploy --only firestore:rules,firestore:indexes --project articton-57fd8`, `firebase deploy --only storage --project articton-57fd8`, and finally `firebase deploy --only hosting --project articton-57fd8` only after approval.
7. Roll back Hosting via release history. Restore the prior version of rules/Functions from version control and explicitly redeploy those components. Data migrations require their separately tested rollback script.

A Hosting-only deployment does **not** deploy Firestore rules, Storage rules, indexes, or Function fixes.

## Obsolete OTP retirement

Confirm web/mobile logs and source contain no callers of `sendEmailOtp`, `verifyEmailOtp`, or `endOtpSession`; revoke any related email-provider key; export configuration/log evidence; then, only after explicit production approval, delete exactly those three deployed Functions. Removing local exports alone leaves their deployed revisions callable. Keep the rollback source/revision identifiers until the observation window closes.
