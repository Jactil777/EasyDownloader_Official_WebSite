# EasyDownloader Official Website

Static, responsive bilingual landing page for [EasyDownloader](https://github.com/Jactil777/EasyDownloader). Built with plain HTML, CSS and JavaScript; no build step or environment variables are required.

## Deploy to Vercel

Import this repository in Vercel. Use the repository root (`./`) as the Root Directory, select **Other** as the Framework Preset, and leave Build Command, Output Directory and Install Command empty. The site is served directly from the repository root.

## Local preview

Open `index.html` in a browser, or run any static file server from this directory, for example:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Content notes

- The platform cards are generated from the project's `测试站点.markdown` compatibility test plan. They are candidate test sites, not a guarantee of current support.
- Site logos load from Google's public favicon service; each card also has an initials fallback.
- The public guestbook uses Supabase Edge Functions and Cloudflare Turnstile. New posts remain pending until manually approved in Supabase Table Editor.
- Release notes and version links currently reflect EasyDownloader v0.1.3 and can be updated in `index.html`.
- The page explicitly asks visitors to follow platform terms, rights and access restrictions.

## Guestbook setup

See [`supabase/SETUP.md`](supabase/SETUP.md) for database setup, Edge Function deployment, Turnstile secrets, public frontend configuration and moderation steps. Never put the Turnstile secret or any database/service-role password in `site-config.js` or Git.
