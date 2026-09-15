# System review ? September 12, 2026

## Login repair and deployment
The live Firestore rules still required an OTP session after the frontend stopped creating one. This blocked the profile read after successful password authentication. Firebase compiled the replacement rules successfully, and the OTP-free rules were deployed. The four active callable functions (askModuleTutor, deleteStudentAccount, startAssessment, submitAssessment) were also successfully updated on September 11.

On September 12, the final Firestore and Storage rules were deployed, including owner/staff read access for legacy mobile score collections and owner-only image uploads for support requests. Existing OTP endpoints and secrets remain deployed for compatibility with older mobile clients. No real user accounts or scores were altered during testing.

## Completed changes
- Light theme default, smaller landing typography, white header branding, functional XL selection, and consistent responsive dashboard columns.
- Consume edit-profile requests once and clear them on logout.
- Password-only login with useful profile-access and network failure messages.
- Support uploads use user-specific paths, enforce image type/size, show submission errors, and prevent duplicate clicks.
- Corrected reversed assembly/disassembly prerequisite description.
- Added opt-in development-only Firebase emulators using demo-articton.
- Applied compatible dependency fixes; npm audit reported zero vulnerabilities after those updates.

## Verification
- Final production build passed: 2.64 MB JavaScript / 736 KB gzip. Bundle-size warning remains.
- Lint: zero errors, 56 warnings, primarily existing unused variables and hook dependencies in 3D code.
- Six authentication/settings regression tests passed.
- Twelve real Firestore/Storage emulator tests passed, covering profile access, signup, staff permissions, role escalation denial, score ownership, legacy results, private answer keys/OTP documents, and support text/image permissions.
- Browser tests with demo accounts passed signup, wrong-password rejection, password-only login, XL selection, profile save, logout/relogin, profile persistence, no unwanted profile popup, modules/practice/achievements navigation, and entry into Module 1 (CPU). The final browser run reported no uncaught JavaScript errors.
- Dashboard main-column bounds passed at 1440x900, 1152x720, 960x600, 720x450, and 390x844 with XL fonts. These simulate reduced viewports; they are not a complete browser-zoom matrix.

## Remaining limits
Full completion of every 3D assembly/disassembly practical, authenticated production account tests, faculty/admin UI flows, and live assessment scoring have not been exhaustively tested. Existing client-written progress/practice scores are not tamper-proof. Frontend Hosting was not deployed during this repair; local source and dist contain the frontend changes.

## Reproduce tests
Run `npm test` for unit regressions. With Java 21+ available, run:

```powershell
npx -y firebase-tools@latest emulators:exec --only auth,firestore,storage --project demo-articton --config firebase.emulators.json "npm run test:rules"
```

For manual browser testing, start these emulators and launch Vite with `VITE_USE_FIREBASE_EMULATORS=true`. Use only demo accounts in that environment. Normal development continues to use the real project unless explicitly opted in.

See mobile-otp-removal-prompt.md for the mobile migration handoff.
