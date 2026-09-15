# Security Predeploy Checklist

Use this before building or deploying production.

## Frontend Environment

- Set `VITE_DEV_BYPASS_LOGIN=false` before running a production build.
- Keep `.env` files ignored. Commit only `.env.example` files with placeholders.
- Firebase web config values are public app configuration, not admin credentials. Restrict the web API key in Google Cloud Console:
  - Add HTTP referrer restrictions for the production domain.
  - Allow only the Firebase/Google APIs the web app needs.
  - Monitor usage for unexpected traffic.

## Firebase Functions

- Login uses Firebase email/password authentication without an email OTP step.
- The OTP-free Firestore rules and four active callable functions have been deployed to `articton-57fd8`; Storage and legacy-score rule fixes were deployed on September 12, 2026. Keep mobile deployments aligned with this shared backend.
- Remove the obsolete deployed `sendEmailOtp`, `verifyEmailOtp`, and `endOtpSession` functions after checking that no older/mobile client still calls them.
- Once obsolete functions are removed, retire their unused `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `OTP_HASH_SECRET` secrets. Historical OTP collections remain denied to clients; no user data needs to be deleted for this migration.
- Keep the tutor's `GEMINI_API_KEY` secret if the tutor is enabled.
- Do not commit service account JSON files, private keys, or generated admin credentials.

## Public Assets

Everything under `public/` is downloadable by users of the deployed app. Keep only assets that can be safely public.

Current public model/image assets are required by the active web experience. If any model is proprietary and must not be downloadable, move it behind authenticated storage or replace it with a non-sensitive optimized version before launch.

## Assessment Data

- Do not ship official answer keys in frontend files.
- Store public question text separately from private answer keys.
- Use callable functions such as `startAssessment` and `submitAssessment` for official scoring.
