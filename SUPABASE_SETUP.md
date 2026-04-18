# Supabase Setup Guide

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New project**
3. Name it `biteerp` (or anything you like)
4. Choose a strong database password — save it somewhere
5. Region: **Middle East (Bahrain)** — closest to your users
6. Click **Create new project** and wait ~2 minutes

---

## Step 2 — Run the database schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the file `supabase/schema.sql` from this project
4. Paste the entire contents into the SQL editor
5. Click **Run** (or Ctrl+Enter)
6. You should see "Success" — all tables and policies are now created

---

## Step 3 — Get your API keys

1. In Supabase dashboard, go to **Settings → API**
2. Copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public** key (long JWT token)

---

## Step 4 — Add environment variables

**For local development:**
1. Copy `.env.example` to `.env`
2. Fill in your Supabase URL and anon key:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**For Vercel (production):**
1. Go to your Vercel project → **Settings → Environment Variables**
2. Add both variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Redeploy

---

## Step 5 — Configure Supabase Auth

1. In Supabase, go to **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g. `https://your-app.vercel.app`)
3. Add to **Redirect URLs**: `https://your-app.vercel.app/**`
4. For local dev, also add: `http://localhost:5173/**`

---

## Step 6 — Install & run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — you'll see the new sign-up screen.

---

## Step 7 — Create your first account

1. Click **Create one** on the login screen
2. Enter your name, email, and password
3. Enter your restaurant name (e.g. "BiteERP")
4. You're in — you're automatically set as the **owner**

---

## Adding team members (owner only)

Currently team members can self-register and you can update their `restaurant_id` in the Supabase dashboard:

1. Ask your team member to sign up at your app URL
2. Go to **Supabase → Table Editor → profiles**
3. Find their row, set `restaurant_id` to your restaurant's ID
4. Set their `role` to `manager` or `cashier`

> A proper invite flow can be added later once you're ready to scale.

---

## Role permissions

| Feature | Owner | Manager | Cashier | Viewer |
|---|---|---|---|---|
| View all data | ✓ | ✓ | ✓ | ✓ |
| Edit calculator | ✓ | ✓ | — | — |
| Log expenses/sales | ✓ | ✓ | ✓ | — |
| Manage staff/suppliers | ✓ | ✓ | — | — |
| Change restaurant settings | ✓ | — | — | — |

---

## Removing Upstash Redis

You no longer need the Upstash Redis environment variables. You can remove from Vercel:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
