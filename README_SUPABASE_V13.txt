HEKAND Auto Division v13 — Supabase Central Database

1. Create the Supabase table app_state using the SQL supplied with this release.
2. Configure environment variables on the Node.js host:
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SECRET_KEY
3. Never put SUPABASE_SECRET_KEY in index.html, GitHub, or the browser.
4. SUPABASE_SECRET_KEY is server-only. Do not share it in chat.
5. The app keeps a local JSON fallback only when Supabase variables are not configured.
