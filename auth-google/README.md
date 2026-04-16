# Auth Google Block

Google OAuth sign-in via Google Identity Services (GIS). Adds a "Sign in with Google" button to login and register pages.

Uses the client-side ID token flow: Google's library renders the button, the user authenticates with Google, and a JWT is sent to your server for verification. The server then issues the same `auth-token` cookie used by JWT auth.

## What You Get

- `useGoogleAuth` composable (initialize, render button, handle callback)
- Server endpoint to verify Google ID tokens and create/link accounts
- Migration adding `google_id` column to users table
- Auto-linking: if a user with the same email already exists, the Google account is linked

## Files

```
app/composables/useGoogleAuth.ts
server/api/auth/google.post.ts
migrations/005_add_google_auth.js
```

## Environment Variables

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Where to get your Google Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services > OAuth consent screen**
   - Choose "External" user type
   - Fill in app name and support email
   - Add your domain to authorized domains
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins**: add `http://localhost:3000` (dev) and your production domain
   - You do NOT need to add redirect URIs (the GIS flow uses popup/one-tap, not redirects)
6. Copy the **Client ID** (looks like `123456789-abcdef.apps.googleusercontent.com`)

### Where to put it

Add to `.env` in your project root:

```env
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

This value is used both server-side (to verify tokens) and client-side (to initialize the Google button). If `GOOGLE_CLIENT_ID` is not set, the Google sign-in UI won't appear.

## Dependencies

- `auth-jwt` (JWT issuance, auth composable, login/register/profile pages)

## npm Packages

```
google-auth-library ^9.0.0
```

## How It Works

1. User clicks "Sign in with Google" on login or register page
2. Google Identity Services opens a popup for the user to authenticate
3. Google returns a JWT (ID token) to the client
4. Client sends the token to `POST /api/auth/google`
5. Server verifies the token with Google's library
6. If user exists with that `google_id`, log them in
7. If user exists with the same email but no `google_id`, link the accounts
8. If no user exists, create a new account (no password set)
9. Server issues an `auth-token` cookie and returns user data
