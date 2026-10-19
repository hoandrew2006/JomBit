# Supabase setup for JomBit

This first backend milestone adds email accounts and private, cross-device cloud persistence for the existing JomBit app state. When Supabase is not configured, the app deliberately keeps its current local demo mode.

## 1. Create the project

Create a Supabase project at <https://database.new>. Save the database password in a password manager; it does not belong in this repository or in Vercel's frontend variables.

## 2. Create the tables and access rules

In the Supabase dashboard, open **SQL Editor**, create a new query, paste the complete contents of `supabase/migrations/202610150001_jombit_cloud_state.sql`, and run it once.

The migration creates `profiles` and `jombit_states`, enables Row Level Security, and limits every state row to its signed-in owner. It also enables Realtime for cross-device updates.

## 3. Copy the public browser values

Open **Project Settings → API** (or **Connect**) and copy:

- Project URL
- Publishable key. Older projects may call this the anonymous `anon` key.

These two values are designed to be used in a browser. The database service-role key is secret and must never be placed in a `VITE_` variable.

For local development, copy `.env.example` to `.env.local` and set:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

For Vercel, add the same two names and values under **Project → Settings → Environment Variables** for Production, Preview and Development, then redeploy.

## 4. Configure the app URL

In Supabase, open **Authentication → URL Configuration**:

- Site URL: `https://jom-bit-6667.vercel.app`
- Redirect URL: `https://jom-bit-6667.vercel.app/**`
- For local work, also add `http://127.0.0.1:5173/**`

JomBit sends new-account confirmation links back to `https://jom-bit-6667.vercel.app/?app=1`, so confirmed users land inside the app rather than on the marketing homepage. The wildcard redirect entry above permits that destination.

Email/password authentication is enabled by default. During early testing, either keep email confirmation enabled and use a real inbox, or turn it off temporarily under Authentication provider settings.

## 5. Verify

Run `npm run dev`, open `http://127.0.0.1:5173/?app=1`, create an account, and finish onboarding. The account should open with no groups, activity, balances or crypto holdings. Create one group; the Supabase Table Editor should show one private row in `jombit_states`. Sign in with the same account in another browser to confirm the state loads there. The separate **Explore the demo** button must not create or update a Supabase row.

## Current scope

This milestone moves the complete current `AppState` document behind Supabase Auth and Row Level Security. It is a safe bridge from the browser-only prototype: existing screens do not need to be rewritten at once, local demo mode still works, and cloud users get account-based persistence and Realtime updates.

True multi-account group collaboration, invitations and per-group permissions require normalized group/expense tables rather than one state document. Private receipt image storage and moving the Gemini, CoinGecko and FX server functions to Supabase Edge Functions are the next backend milestones. Until those are completed, receipt/provider APIs continue to run through the existing Vercel functions.
