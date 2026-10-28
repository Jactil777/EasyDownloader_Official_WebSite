# Guestbook setup (Supabase + Turnstile)

The website remains static on Vercel. Supabase stores messages and runs the public Edge Function; Cloudflare Turnstile challenges automated submissions. Visitors do not need an account. Every new message is hidden until approved.

## 1. Create the messages tables

In Supabase, open **SQL Editor → New query**. Open `migrations/202610280001_guestbook.sql`, copy all of it into the query, and click **Run**. This creates the messages and rate-limit tables. Anonymous browser roles receive no direct table access; the Edge Function handles reads and writes.

## 2. Configure Edge Function secrets

In **Project Settings → Edge Functions → Secrets** (or **Edge Functions → Secrets**), add:

| Name | Value |
| --- | --- |
| `TURNSTILE_SECRET_KEY` | The rotated Turnstile Secret Key. Never put this in Git or the website. |
| `GUESTBOOK_ALLOWED_ORIGINS` | The exact production origin: `https://easydownloader-nine.vercel.app` (no trailing slash). |
| `GUESTBOOK_RATE_SALT` | A long random private string used to hash visitor IPs before rate-limit storage. |

The Supabase Edge Function receives its Supabase URL and privileged key from the platform; do not add those keys to the website bundle.

## 3. Deploy the function

Install or use the Supabase CLI, then run these commands from the repository root in PowerShell:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy guestbook
```

Find `YOUR_PROJECT_REF` in the Supabase project URL: it is the hostname prefix before `.supabase.co`. The function has `verify_jwt = false` at the gateway because it validates the public Publishable Key itself. Do not change the function's `withSupabase({ auth: 'publishable' })` check.

## 4. Add public values to the website

Edit `site-config.js` and fill only these public fields:

```js
window.EASYDOWNLOADER_CONFIG = {
  supabaseUrl: 'https://cbmjyxmurghztnlvxamn.supabase.co',
  supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
  turnstileSiteKey: 'YOUR_TURNSTILE_SITE_KEY'
};
```

The Publishable Key and Turnstile Site Key are intended for browser use. Never put a Turnstile Secret Key, Supabase Secret Key, legacy service-role key, or database password here. Commit and push the public config so Vercel rebuilds the site.

The current production hostname is `easydownloader-nine.vercel.app`; it must be listed in the Turnstile widget's **Hostname Management**, and the Edge Function allowlist must use `https://easydownloader-nine.vercel.app` with no trailing slash. If you use a custom domain later, add that hostname there too.

## 5. Review and manage messages

In Supabase, open **Table Editor → guestbook_messages**:

- Review rows whose `status` is `pending`.
- Change `status` to `approved` to show a message publicly.
- Change it to `rejected` or delete the row to remove it.

The public function only returns `approved` messages. The form includes Turnstile validation, a hidden honeypot, a 60-second per-IP posting limit, and input length limits. IP addresses are HMAC-hashed with the private rate-limit salt before storage; raw IPs are not saved in the rate-limit table.

## Safety

- The screenshot shared during setup displayed the Turnstile Secret Key. Rotate it in Cloudflare before using this deployment, then store only the replacement in Supabase Edge Function Secrets.
- A Supabase database password shared in chat should also be reset in **Project Settings → Database**. It is not needed for this guestbook setup.
- Never send private keys or database passwords in chat, commit them to Git, or place them in Vercel static-site files.
