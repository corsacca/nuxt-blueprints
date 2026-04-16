# Google Auth Block

Google OAuth sign-in via Google Identity Services (GIS). Adds a "Sign in with Google" button to login and register pages. Uses the client-side ID token flow — Google's library renders a button, returns a JWT, and the server verifies it and issues the same `auth-token` cookie used by JWT auth.

## Dependencies

- `auth-jwt` (JWT issuance, auth composable, login/register/profile pages, middleware)

## Files Provided

```
app/composables/useGoogleAuth.ts
server/api/auth/google.post.ts
migrations/005_add_google_auth.js
```

## Package Dependencies

```json
{
  "google-auth-library": "^9.0.0"
}
```

## Config

Add to `nuxt.config.ts` runtimeConfig (server-side, used for token verification):

```typescript
googleClientId: process.env.GOOGLE_CLIENT_ID || '',
```

Add to `nuxt.config.ts` runtimeConfig.public (client-side, used for GIS initialization):

```typescript
googleClientId: process.env.GOOGLE_CLIENT_ID || '',
```

## Environment Variables

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

## Migrations

- `005_add_google_auth.js` — Adds `google_id` (TEXT UNIQUE) column to users table, makes `password` column nullable for Google-only accounts, adds index on `google_id`

## Wiring Notes

When this block is included, modify files provided by `auth-jwt` and `core`:

---

### `server/api/auth/me.get.ts` — Add `has_password` and `has_google` flags

Change the SELECT query to include password and Google status:

```typescript
const users = await sql`
  SELECT id, email, display_name, avatar, verified, superadmin, created, updated,
         password IS NOT NULL as has_password,
         google_id IS NOT NULL as has_google
  FROM users
  WHERE id = ${authUser.userId}
`
```

---

### `server/api/auth/login.post.ts` — Guard against null password

Before the `bcrypt.compare()` call, add a null check so Google-only users get a clean 401 instead of a server error:

```typescript
// After: const user = users[0]
// After the verified check, before bcrypt.compare:

if (!user.password) {
  logLoginFailed(email, userAgent, { reason: 'no_password' })
  throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
}
```

---

### `server/api/profile/password.patch.ts` — Allow setting initial password

After fetching the user's password hash, add a branch for null passwords. Google-only users can set their first password without providing a current one:

```typescript
const currentPasswordHash = userResult[0].password

// Google-only user setting their first password
if (!currentPasswordHash) {
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
  await sql`
    UPDATE users SET password = ${newPasswordHash}, updated = NOW() WHERE id = ${user.userId}
  `

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

Also remove the early validation that requires `current_password` — change it from a hard requirement to only required when the user has a password. Move the `if (!current_password)` check into the existing-password branch.

---

### `server/api/profile/account.delete.ts` — Allow deletion without password

After fetching the user's password hash, add a branch for null passwords:

```typescript
const currentPasswordHash = userResult[0].password

if (currentPasswordHash) {
  // Existing behavior: verify password
  if (!password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Password is required' })
  }
  const isPasswordValid = await bcrypt.compare(password, currentPasswordHash)
  if (!isPasswordValid) {
    logEvent({ ... }) // existing failed deletion log
    throw createError({ statusCode: 401, statusMessage: 'Password is incorrect' })
  }
}
// If no password hash (Google-only user), skip password verification
```

Move the existing password validation and bcrypt check inside the `if (currentPasswordHash)` block. The rest of the deletion logic stays unchanged.

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

### `app/composables/useAuth.ts` — Add `loginWithGoogle` method

Add this method alongside the existing `login`, `register`, etc.:

```typescript
const loginWithGoogle = async (credential: string) => {
  try {
    const response = await $fetch('/api/auth/google', {
      method: 'POST',
      body: { credential }
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

    return { success: false, message: 'Google login failed' }
  } catch (error: any) {
    return {
      success: false,
      message: error.data?.message || 'An error occurred during Google login'
    }
  }
}
```

Update `deleteAccount` parameter to be optional:

```typescript
const deleteAccount = async (password?: string) => {
  // ... existing body, but pass { password } even if undefined
```

Add `loginWithGoogle` to the return object.

---

### `app/pages/login.vue` — Add Google sign-in button

In `<script setup>`, add:

```typescript
const { loginWithGoogle } = useAuth()
const { isAvailable: googleAvailable, initialize: initGoogle, renderButton: renderGoogleButton } = useGoogleAuth()

const googleButtonRef = ref<HTMLElement>()
const googleLoading = ref(false)

async function handleGoogleCallback(credential: string) {
  googleLoading.value = true
  error.value = ''
  try {
    const result = await loginWithGoogle(credential)
    if (!result.success) {
      error.value = result.message || 'Google sign-in failed'
    }
  } finally {
    googleLoading.value = false
  }
}

onMounted(async () => {
  if (googleAvailable.value && googleButtonRef.value) {
    await initGoogle(handleGoogleCallback)
    await renderGoogleButton(googleButtonRef.value)
  }
})
```

In the template, insert between the "Sign In" `<UButton>` (line 187) and the "Don't have an account?" divider (line 189):

```html
<!-- Google Sign In -->
<template v-if="googleAvailable">
  <div class="relative">
    <div class="absolute inset-0 flex items-center">
      <div class="w-full border-t border-(--ui-border)"></div>
    </div>
    <div class="relative flex justify-center text-sm">
      <span class="px-2 bg-(--ui-bg) text-(--ui-text-muted)">Or continue with</span>
    </div>
  </div>
  <div ref="googleButtonRef" class="flex justify-center"></div>
</template>
```

---

### `app/pages/register.vue` — Add Google sign-in button

Same setup as login. In `<script setup>`, add the same Google imports and callback handler.

In the template, insert between the "Create Account" `<UButton>` (line 217) and the "Already have an account?" divider (line 219):

```html
<!-- Google Sign In -->
<template v-if="googleAvailable">
  <div class="relative">
    <div class="absolute inset-0 flex items-center">
      <div class="w-full border-t border-(--ui-border)"></div>
    </div>
    <div class="relative flex justify-center text-sm">
      <span class="px-2 bg-(--ui-bg) text-(--ui-text-muted)">Or continue with</span>
    </div>
  </div>
  <div ref="googleButtonRef" class="flex justify-center"></div>
</template>
```

---

### `app/pages/profile.vue` — Conditional password UI

In `<script setup>`, update the `canSubmitEmail` computed to handle Google-only users:

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

Update `canSubmitPassword` to not require current password for Google-only users:

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

Update `handleDeleteAccount` to work without password for Google-only users:

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

**Account Information card** — Add Google linked status after the "Account created" line:
```html
<div v-if="user?.has_google">
  <span class="font-medium">Sign-in:</span>
  <span class="ml-2 text-(--ui-text-muted)">Google account linked</span>
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
| Existing email/password user signs in with Google (same email) | Account linking — `google_id` is set, user can use either method |
| Google-only user tries email/password login | Guard in `login.post.ts` returns 401 cleanly |
| Google-only user uses "Forgot Password" | Works — reset-password flow sets a new password hash |
| `GOOGLE_CLIENT_ID` not set | No Google UI appears, endpoint returns 400 if called directly |
| Google account email differs from app email after user changes email | Sign-in looks up by `google_id` first, so it still works |

## Admin Setup

To get a Google Client ID:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Go to APIs & Services → Credentials
4. Configure the OAuth Consent Screen (app name, support email)
5. Create an OAuth 2.0 Client ID (type: Web application)
6. Add authorized JavaScript origins (e.g., `http://localhost:3000`, `https://yourapp.com`)
7. Copy the Client ID into your `.env` as `GOOGLE_CLIENT_ID`
