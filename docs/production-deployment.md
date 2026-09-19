# ARTICTON production deployment guide

Production project: `articton-57fd8`. This is a manual, approval-gated release. The repository scripts never enable billing, delete Functions, or migrate live data.

## Current release blockers

Do not execute production deployment until isolated staging and the complete signed-in WebGL browser regression have passed. Model transfer is also unresolved: the current artifact is about 529 MB, dominated by two approximately 96 MB CPU files and three approximately 42 MB case files. Compilation is not runtime evidence.

## One-time console preparation

1. Create a separate staging Firebase project and web app. Use a distinct `.env.staging`; never reuse production credentials or project IDs.
2. Add only the intended production domains in Authentication > Settings > Authorized domains.
3. Register the production web app in App Check with reCAPTCHA Enterprise. Monitor valid/invalid traffic in staging before setting `ENFORCE_APP_CHECK=true` on callable Functions.
4. Configure budget alerts and billing notifications. They are delayed notifications, not a hard zero-cost cap.
5. Enable Firestore database deletion protection in Google Cloud after approval.
6. Review existing Storage download tokens before changing access to previously uploaded photos. New profile and support uploads are disabled by the UI and rules.

## Local verification

From PowerShell in the repository root:

```powershell
npm ci
npm test
npm run lint
$java = (Get-ChildItem 'C:\Program Files\Microsoft\jdk-21*\bin\java.exe' | Select-Object -First 1).FullName
$env:PATH = "$(Split-Path $java);$env:PATH"
npx -y firebase-tools@latest emulators:exec --only firestore,storage --project demo-articton "npm run test:rules"
npm run build
npm run release:artifact
```

Create `.env.production` from `.env.production.example` and insert the real public Firebase web configuration and App Check site key. Never put server secrets in a Vite variable.

## Optional summary backfill (separate approval)

The backfill copies only minimal student identity fields. It does not copy private profile fields or relabel legacy scores as verified. Dry-run first with Application Default Credentials:

```powershell
$env:GCLOUD_PROJECT = 'articton-57fd8'
npm --prefix functions run backfill:student-summaries
```

Execution is a live data migration and requires explicit approval:

```powershell
$env:GCLOUD_PROJECT = 'articton-57fd8'
$env:ARTICTON_MIGRATION_APPROVED = 'BACKFILL_articton-57fd8'
npm --prefix functions run backfill:student-summaries -- --execute
```

## Release preflight and manual execution

Login and select the exact project, then run the non-mutating plan:

```powershell
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use articton-57fd8
npm run release:plan
```

After staging evidence and explicit production approval, execute the already-built, hash-checked artifact:

```powershell
$env:ARTICTON_PRODUCTION_APPROVED = 'DEPLOY_articton-57fd8'
npm run release:execute
```

The script deploys Functions, indexes, Firestore rules, Storage rules, then Hosting, stopping at the first failure. It does not rebuild. Regenerate `release-artifact.json` after any protected input or `dist` change.

## Smoke checks

- Register, sign in/out, reset password, and verify unauthorized cross-user reads fail.
- Complete one assessment at the 74/75 boundary and verify only the server result appears.
- Complete and retake each practical; verify timing, fullscreen exit, completion card, deductions, and idempotent retry.
- Complete AMD/Intel guided modules and verify server-owned completion and achievements.
- Verify faculty uses `student_summaries`, administrators retain required access, and private fields are absent.
- Verify App Check valid traffic succeeds and invalid callable requests fail.
- Test all routes, 3D interactions, light/dark themes, responsive layouts, CSP, refresh/resume, and interrupted requests.

## Rollback

Keep the prior known-good full release artifact and source revision. Roll back by redeploying its Functions, indexes, Firestore rules, Storage rules, and Hosting in the same guarded order. Do not roll back Hosting alone if that client expects newer protected endpoints, and never loosen rules merely to support cached clients. If a release stops partway, inspect the completed-step output before deciding whether to finish forward or redeploy the prior full secure release.

## Cost warning

The production project is on Blaze. Deployment itself does not guarantee a charge, and no-cost allowances apply, but usage above them is billed. The large 529 MB site can exceed Hosting's 360 MB/day no-cost transfer with a single uncached full download. Functions, Firestore, Storage, Artifact Registry, Cloud Build, Gemini, and reCAPTCHA Enterprise may also incur usage. Budget alerts cannot guarantee a zero bill.
