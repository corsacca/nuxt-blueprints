# Auth Firebase Block

Firebase Authentication as an identity layer for multi-provider OAuth. Supports Google, Apple, GitHub, and Microsoft sign-in via the Firebase client SDK.

Firebase handles the OAuth dance on the client. Your server verifies the Firebase ID token and issues the same `auth-token` cookie used by JWT auth. User records stay in your Postgres database.

## What You Get

- `useFirebaseAuth` composable (provider buttons, popup sign-in, token handling)
- Server endpoint to verify Firebase tokens and create/link accounts
- Migration adding `firebase_uid` column to users table
- Support for multiple OAuth providers via a single integration

## Files

```
app/composables/useFirebaseAuth.ts
server/api/auth/firebase.post.ts
migrations/005_add_firebase_auth.js
```

## Environment Variables

```env
# Client-side (public, safe to expose)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_AUTH_PROVIDERS=google

# Server-side (secret, never expose)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

### Where to get Firebase credentials

#### Client-side keys (FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or select existing)
3. Go to **Project Settings > General** (gear icon at top-left)
4. Scroll to "Your apps" -- if none exist, click the web icon (`</>`) to register a web app
5. Copy `apiKey`, `authDomain`, and `projectId` from the config snippet

These are safe to expose in client-side code. They identify your project but don't grant admin access.

#### Service account key (FIREBASE_SERVICE_ACCOUNT)

1. In Firebase Console, go to **Project Settings > Service Accounts**
2. Click **Generate New Private Key**
3. A JSON file downloads. Copy its entire contents as a single-line string into your `.env`:

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"my-project","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk@my-project.iam.gserviceaccount.com",...}
```

This key is a secret. Never commit it to git or expose it client-side.

#### Enable providers (FIREBASE_AUTH_PROVIDERS)

1. In Firebase Console, go to **Authentication > Sign-in method**
2. Enable the providers you want (Google, GitHub, Apple, Microsoft)
3. Each provider has setup requirements:
   - **Google**: works out of the box with Firebase
   - **GitHub**: requires a GitHub OAuth App ([create one here](https://github.com/settings/applications/new)), paste the client ID and secret into Firebase
   - **Apple**: requires an Apple Developer account and Sign in with Apple service ID
   - **Microsoft**: requires an Azure AD app registration
4. Set `FIREBASE_AUTH_PROVIDERS` to a comma-separated list matching what you enabled:

```env
FIREBASE_AUTH_PROVIDERS=google,github
```

Supported values: `google`, `github`, `apple`, `microsoft`. Defaults to `google` if not set.

### Where to put it

Add all values to `.env` in your project root. If `FIREBASE_API_KEY` is not set, the Firebase sign-in UI won't appear.

## Dependencies

- `auth-jwt` (JWT issuance, auth composable, login/register/profile pages)

## npm Packages

```
firebase ^11.0.0
firebase-admin ^13.0.0
```

## Auth Google vs Auth Firebase

Both blocks provide social sign-in. Choose one:

- **auth-google**: lighter weight, only Google sign-in, uses Google Identity Services directly
- **auth-firebase**: heavier, but supports Google + GitHub + Apple + Microsoft via Firebase

If you only need Google sign-in, `auth-google` is simpler. If you need multiple providers, use `auth-firebase`.

Both can coexist if needed -- they use different database columns (`google_id` vs `firebase_uid`) and different endpoints.
