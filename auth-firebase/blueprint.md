# Firebase Auth Block

Firebase Authentication as an identity layer for multi-provider OAuth. Supports Google, Apple, GitHub, and Microsoft sign-in via the Firebase client SDK. Firebase handles the OAuth dance; our server verifies the Firebase ID token and issues the same `auth-token` cookie used by JWT auth. User records stay in Postgres.

**Note:** This block and `auth-google` are alternatives — both provide social sign-in with the same null-password handling pattern. Prefer `auth-firebase` when you need multiple providers. If both are included, the null-password wiring notes are identical and idempotent; the unique parts (different DB columns, composables, endpoints) do not conflict.

## Dependencies

- `auth-jwt` (JWT issuance, auth composable, login/register/profile pages, middleware)

## Files Provided

```
app/composables/useFirebaseAuth.ts
server/api/auth/firebase.post.ts
server/database/schema.ts
migrations/005_add_firebase_auth.ts
```

## Package Dependencies

```json
{
  "firebase": "^11.0.0",
  "firebase-admin": "^13.0.0"
}
```

## Config

Add to `nuxt.config.ts` runtimeConfig (server-side):

```typescript
firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
```

Add to `nuxt.config.ts` runtimeConfig.public (client-side):

```typescript
firebaseApiKey: process.env.FIREBASE_API_KEY || '',
firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
firebaseAuthProviders: process.env.FIREBASE_AUTH_PROVIDERS || 'google',
```

Add Vite optimization for the Firebase client SDK:

```typescript
vite: {
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth'],
  },
},
```

## Environment Variables

```env
# Firebase Client (public, safe to expose)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_AUTH_PROVIDERS=google

# Firebase Admin (server-only, keep secret)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

`FIREBASE_AUTH_PROVIDERS` is a comma-separated list of enabled providers. Supported values: `google`, `github`, `apple`, `microsoft`. Defaults to `google` if not set.

## Migrations

- `005_add_firebase_auth.ts` — Adds `firebase_uid` (TEXT UNIQUE) column to users table, makes `password` column nullable for Firebase-only accounts, adds index on `firebase_uid`

## Database & Types

- `server/database/schema.ts` — Extends `UsersTable` with `firebase_uid` and relaxes `password` to nullable. Merge into the project's consolidated `server/database/schema.ts` during assembly (after core + auth-jwt).

## Wiring Notes

When this block is included, modify files provided by `auth-jwt` and `core`:

---

### `server/api/auth/me.get.ts` — Add `has_password` and `has_firebase` flags

Change the SELECT to include password and Firebase status via computed columns:

```typescript
import { sql } from 'kysely'

const user = await db
  .selectFrom('users')
  .select([
    'id', 'email', 'display_name', 'avatar', 'verified', 'superadmin', 'created', 'updated',
    sql<boolean>`password IS NOT NULL`.as('has_password'),
    sql<boolean>`firebase_uid IS NOT NULL`.as('has_firebase'),
  ])
  .where('id', '=', authUser.userId)
  .executeTakeFirst()
```

---

### `server/api/auth/login.post.ts` — Guard against null password

Before the `bcrypt.compare()` call, add a null check so Firebase-only users get a clean 401 instead of a server error:

```typescript
// After the verified check, before bcrypt.compare:

if (!user.password) {
  logLoginFailed(email, userAgent, { reason: 'no_password' })
  throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
}
```

---

### `server/api/profile/password.patch.ts` — Allow setting initial password

After fetching the user's password hash, add a branch for null passwords. Firebase-only users can set their first password without providing a current one:

```typescript
import { sql } from 'kysely'

const current = await db
  .selectFrom('users')
  .select('password')
  .where('id', '=', user.userId)
  .executeTakeFirst()

// Firebase-only user setting their first password
if (!current?.password) {
  if (!new_password || typeof new_password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'New password is required' })
  }
  if (new_password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'New password must be at least 8 characters long' })
  }
  if (new_password.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'New password is too long (max 128 characters)' })
  }

  const newPasswordHash = await bcrypt.hash(new_password, 12)
  await db
    .updateTable('users')
    .set({ password: newPasswordHash, updated: sql`now()` })
    .where('id', '=', user.userId)
    .execute()

  logEvent({
    eventType: 'PASSWORD_CHANGED',
    tableName: 'users',
    recordId: user.userId,
    userId: user.userId,
    userAgent: getHeader(event, 'user-agent') || undefined,
    metadata: { initial_password: true }
  })

  return { success: true, message: 'Password set successfully' }
}
```

Also remove the early validation that requires `current_password` — move that check into the existing-password branch.

---

### `server/api/profile/account.delete.ts` — Allow deletion without password

After fetching the user's password hash, add a branch for null passwords:

```typescript
if (current.password) {
  // Existing behavior: verify password
  if (!password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Password is required' })
  }
  const isPasswordValid = await bcrypt.compare(password, current.password)
  if (!isPasswordValid) {
    logEvent({ ... }) // existing failed deletion log
    throw createError({ statusCode: 401, statusMessage: 'Password is incorrect' })
  }
}
// If no password hash (Firebase-only user), skip password verification
```

Move the existing password validation and bcrypt check inside the `if (current.password)` block. The rest of the deletion logic stays unchanged.

---

### `server/api/profile/email.post.ts` — Allow email change without password

Same pattern as account deletion. After fetching the user, check if they have a password:

```typescript
if (currentUser.password) {
  // Existing behavior: verify password
  if (!current_password) {
    throw createError({ statusCode: 400, statusMessage: 'Current password is required' })
  }
  const isValid = await bcrypt.compare(current_password, currentUser.password)
  if (!isValid) {
    throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
  }
}
```

---

### `app/composables/useAuth.ts` — Add `loginWithFirebase` method

Add this method alongside the existing `login`, `register`, etc.:

```typescript
const loginWithFirebase = async (idToken: string) => {
  try {
    const response = await $fetch('/api/auth/firebase', {
      method: 'POST',
      body: { idToken }
    }) as { success: boolean; user?: any }

    if (response.success) {
      user.value = response.user
      saveToCache(response.user)

      const route = useRoute()
      const redirectTo = route.query.redirect as string

      if (redirectTo && redirectTo.startsWith('/')) {
        await navigateTo(redirectTo)
      } else {
        await navigateTo('/')
      }

      return { success: true }
    }

    return { success: false, message: 'Firebase login failed' }
  } catch (error: any) {
    return {
      success: false,
      message: error.data?.message || 'An error occurred during Firebase login'
    }
  }
}
```

Update `deleteAccount` parameter to be optional:

```typescript
const deleteAccount = async (password?: string) => {
```

Add `loginWithFirebase` to the return object.

---

### `app/pages/login.vue` — Add Firebase sign-in buttons

In `<script setup>`, add:

```typescript
const { loginWithFirebase } = useAuth()
const { isAvailable: firebaseAvailable, enabledProviders, providerMeta, signInWithProvider } = useFirebaseAuth()

const firebaseLoading = ref(false)

async function handleFirebaseSignIn(providerName: string) {
  firebaseLoading.value = true
  error.value = ''
  try {
    const idToken = await signInWithProvider(providerName)
    const result = await loginWithFirebase(idToken)
    if (!result.success) {
      error.value = result.message || 'Sign-in failed'
    }
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user') return
    error.value = err.message || 'Sign-in failed'
  } finally {
    firebaseLoading.value = false
  }
}
```

In the template, insert between the "Sign In" `<UButton>` (line 187) and the "Don't have an account?" divider (line 189):

```html
<!-- Firebase Sign In -->
<template v-if="firebaseAvailable">
  <div class="relative">
    <div class="absolute inset-0 flex items-center">
      <div class="w-full border-t border-(--ui-border)"></div>
    </div>
    <div class="relative flex justify-center text-sm">
      <span class="px-2 bg-(--ui-bg) text-(--ui-text-muted)">Or continue with</span>
    </div>
  </div>
  <div class="flex flex-col gap-2">
    <UButton
      v-for="provider in enabledProviders"
      :key="provider"
      color="neutral"
      variant="outline"
      size="lg"
      block
      :icon="providerMeta[provider]?.icon"
      :loading="firebaseLoading"
      :disabled="firebaseLoading"
      @click="handleFirebaseSignIn(provider)"
    >
      Continue with {{ providerMeta[provider]?.label || provider }}
    </UButton>
  </div>
</template>
```

---

### `app/pages/register.vue` — Add Firebase sign-in buttons

Same setup as login. In `<script setup>`, add the same Firebase imports and callback handler.

In the template, insert between the "Create Account" `<UButton>` (line 217) and the "Already have an account?" divider (line 219) — same template block as login.vue.

---

### `app/pages/profile.vue` — Conditional password UI

In `<script setup>`, update the `canSubmitEmail` computed to handle Firebase-only users:

```typescript
const canSubmitEmail = computed(() => {
  const hasRequiredFields = emailState.new_email.trim() &&
    !emailLoading.value &&
    emailState.new_email !== user.value?.email
  if (user.value?.has_password) {
    return hasRequiredFields && !!emailState.current_password
  }
  return hasRequiredFields
})
```

Update `canSubmitPassword` to not require current password for Firebase-only users:

```typescript
const canSubmitPassword = computed(() => {
  const hasNewPassword = passwordState.new_password.length >= 8 &&
    passwordMatch.value &&
    !passwordLoading.value
  if (user.value?.has_password) {
    return hasNewPassword && !!passwordState.current_password
  }
  return hasNewPassword
})
```

Update `handlePasswordChange` to only send `current_password` when the user has one:

```typescript
const body: any = { new_password: passwordState.new_password }
if (user.value?.has_password) {
  body.current_password = passwordState.current_password
}
```

Update `handleDeleteAccount` to work without password for Firebase-only users:

```typescript
async function handleDeleteAccount() {
  deleteError.value = ''
  if (!deleteState.confirmDelete) return
  if (user.value?.has_password && !deleteState.password) return

  deleteLoading.value = true
  try {
    const result = await deleteAccount(user.value?.has_password ? deleteState.password : undefined)
    if (!result.success) {
      deleteError.value = result.message || 'Failed to delete account'
    }
  } catch (err: any) {
    deleteError.value = err.data?.statusMessage || 'Failed to delete account'
  } finally {
    deleteLoading.value = false
  }
}
```

In the template:

**Account Information card** — Add Firebase linked status after the "Account created" line:
```html
<div v-if="user?.has_firebase">
  <span class="font-medium">Sign-in:</span>
  <span class="ml-2 text-(--ui-text-muted)">Firebase account linked</span>
</div>
```

**Change Email card** — Wrap the Current Password field in `v-if="user?.has_password"`:
```html
<UFormField v-if="user?.has_password" label="Current Password">
  ...
</UFormField>
```

**Change Password card** — Conditional header and current password field:
```html
<h2 class="text-xl font-semibold">{{ user?.has_password ? 'Change Password' : 'Set a Password' }}</h2>
```
Wrap the Current Password field in `v-if="user?.has_password"`:
```html
<UFormField v-if="user?.has_password" label="Current Password">
  ...
</UFormField>
```

**Delete Account card** — Wrap password field and update checkbox:
```html
<UFormField v-if="user?.has_password" label="Enter your password to confirm">
  ...
</UFormField>
```
Update the checkbox disabled condition:
```html
<UCheckbox
  v-model="deleteState.confirmDelete"
  :disabled="(user?.has_password && !deleteState.password) || deleteLoading"
/>
```
Update the delete button disabled condition:
```html
:disabled="(user?.has_password && !deleteState.password) || !deleteState.confirmDelete || deleteLoading"
```

## Edge Cases

| Scenario | Handling |
|---|---|
| Existing email/password user signs in with Firebase (same email) | Account linking — `firebase_uid` is set, user can use either method |
| Firebase-only user tries email/password login | Guard in `login.post.ts` returns 401 cleanly |
| Firebase-only user uses "Forgot Password" | Works — reset-password flow sets a new password hash |
| Firebase config not set | No Firebase UI appears, endpoint returns 400 if called directly |
| Malformed `FIREBASE_SERVICE_ACCOUNT` | Server returns 500 with clear error message |
| Popup blocked or cancelled by user | Catch Firebase error, silently reset or display message |
| Multiple Firebase providers → same Firebase UID | One `firebase_uid` column covers all providers |
| Both auth-google and auth-firebase included | Non-conflicting — different columns, endpoints, composables. Null-password wiring is idempotent |

## Admin Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create or select a project
3. Go to **Authentication > Sign-in method**
4. Enable desired providers (Google, Apple, GitHub, Microsoft)
   - Each provider has its own setup requirements (OAuth client IDs, etc.) — follow Firebase's in-console instructions
5. Go to **Project Settings > General** to find your `apiKey`, `authDomain`, and `projectId`
6. Go to **Project Settings > Service accounts > Generate new private key**
7. Copy the downloaded JSON contents into `FIREBASE_SERVICE_ACCOUNT` env var as a single-line JSON string
8. Set `FIREBASE_AUTH_PROVIDERS` to a comma-separated list matching the providers you enabled (e.g., `google,github,apple`)
