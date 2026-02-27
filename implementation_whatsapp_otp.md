# Real WhatsApp OTP Integration Plan

**Goal:** Integrate the custom Supabase Edge Functions (`whatsapp-otp-send` and `whatsapp-otp-verify`) into the frontend for Production, while keeping the `999999` mock bypass fully functional in the Development environment.

## Changes Required

### 1. Update `LoginModal.jsx` (Sending OTP)
We will introduce a dual-path logic based on `process.env.NODE_ENV`.

**If Production:**
- `handleSendOtp` will call the `whatsapp-otp-send` Edge Function via `supabase.functions.invoke`.
- This triggers the real Meta WhatsApp API.

**If Development:**
- Show a UI toggle or automatically fall back to the mock behavior. As requested, we will keep the `999999` bypass available so you are never blocked during local development.
- The UI will clearly indicate `[DEV MODE: Mock OTP Active]` so you always know which flow is running.

### 2. Update `TagdeerContext.jsx` (Verifying OTP)
Similarly, `loginWithOtp` will branch based on the environment/input.

**If Production (or real OTP flow):**
- Call the `whatsapp-otp-verify` Edge Function.
- The Edge Function returns the user profile data and an `isNewUser` flag.
- Set the local state (`setUser`) using this returned profile.

**If Development (and user enters `999999`):**
- Continue to use the existing mock `login(phone)` bypass logic.

### 3. Deploy Edge Functions
- Deploy both functions to your production Supabase project:
  ```bash
  supabase functions deploy whatsapp-otp-send
  supabase functions deploy whatsapp-otp-verify
  ```
- Set the Meta API secrets in production:
  ```bash
  supabase secrets set META_PHONE_NUMBER_ID=... META_ACCESS_TOKEN=... META_TEMPLATE_NAME=tagdeer_otp META_TEMPLATE_LANG=ar
  ```

### 4. Security Note
Both the current mock system and this new Edge Function system rely on client-side state (`localStorage`) for the session. To reach full 9+ security, the next phase (after this is working) is to have the Edge Function issue a proper Supabase Auth JWT and store it in an HttpOnly cookie. For now, we are focusing *only* on getting the real WhatsApp messages integrated smoothly.
