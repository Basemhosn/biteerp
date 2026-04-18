# The Slope Trio Revenue Forecast

## Deploy to Vercel

```bash
npm install
vercel --prod
```

## Setting up user persistence (Upstash Redis — free)

Vercel KV has been discontinued. Use Upstash Redis instead — it's free and takes 3 minutes.

**Step 1 — Create a free Upstash database**
1. Go to [console.upstash.com](https://console.upstash.com) and sign up (free)
2. Click **Create Database**
3. Name it `slope-trio`, choose the region closest to you (e.g. `us-east-1`)
4. Click **Create**

**Step 2 — Copy your credentials**
On the database page, scroll to **REST API** and copy:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Step 3 — Add to Vercel**
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add these two variables:
   - `KV_REST_API_URL` → your Upstash REST URL
   - `KV_REST_API_TOKEN` → your Upstash REST token
3. Click **Save** then **Redeploy**

That's it — user PINs and saved states will now persist across sessions.

## Users

| Username | Default PIN | Role  |
|----------|-------------|-------|
| basem    | 2027        | admin |
| farouk   | (set on first login) | user |
| dara     | (set on first login) | user |

To add/remove users, edit `api/login.js`, `api/setpin.js`, and `api/users.js`.

## Local development

```bash
npm install
npm run dev
```

For API routes locally, use `vercel dev` with a `.env.local` file containing your Upstash credentials.
