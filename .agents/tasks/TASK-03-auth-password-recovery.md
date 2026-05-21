# TASK 03: Auth Password Recovery Fix

**Goal:** Ensure password reset flow works correctly for merchants by verifying the redirect URL and callback event handling.

## Target File 1
`src/app/(portals)/merchant/settings/page.jsx`

## Instructions 1
1. Find the `redirectUrl` definition (around line 325) for the password reset flow.
2. Ensure it appends `&from=merchant` to the URL.
   - **Current:** `const redirectUrl = \`\${window.location.origin}/auth/callback?next=/merchant/reset-password\`;`
   - **Change to:** `const redirectUrl = \`\${window.location.origin}/auth/callback?next=/merchant/reset-password&from=merchant\`;`

## Target File 2
`src/app/(consumer)/auth/callback/page.jsx`

## Instructions 2
1. Find the `onAuthStateChange` listener (usually in a `useEffect`).
2. Ensure `PASSWORD_RECOVERY` is included in the event check.
   - **Look for:** `if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && newSession?.user)`
   - **Change to:** `if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') && newSession?.user)`

## Verification
- Build the app: `npm run build`
- No syntax errors introduced.
