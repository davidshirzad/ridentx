# RideNTX — Deployment Guide
## Getting your live cycling events site online in ~15 minutes

---

## What you're deploying

```
ridentx/
├── vercel.json          ← Tells Vercel how to route traffic
├── api/
│   ├── bikereg.js       ← Serverless proxy: fetches BikeReg events
│   └── bikesignup.js    ← Serverless proxy: fetches BikeSignUp events
└── public/
    └── index.html       ← Your RideNTX website
```

When someone visits your site, the page calls `/api/bikereg` and `/api/bikesignup`.
Vercel runs those two tiny functions, which fetch from BikeReg and BikeSignUp on the
server side (no CORS issues), then hand the data back to your page. Results are cached
for 1 hour so the APIs don't get hammered.

---

## Step 1 — Create a free GitHub account

> Skip this step if you already have GitHub.

1. Go to **https://github.com**
2. Click **Sign up** — use any email address
3. Choose the **Free** plan
4. Verify your email

---

## Step 2 — Create a new GitHub repository

A "repository" (repo) is just a folder in the cloud where your site files live.

1. Once logged in to GitHub, click the **+** icon in the top-right corner
2. Click **New repository**
3. Name it `ridentx` (or anything you like)
4. Leave it set to **Public**
5. Leave everything else as default
6. Click **Create repository**

You'll land on an empty repo page. Keep this tab open.

---

## Step 3 — Upload your project files

GitHub has a built-in file uploader — no command line needed.

1. On your empty repo page, click **uploading an existing file** (in the center of the page)
2. Drag and drop the **entire `ridentx` folder** from your computer into the upload area
   - Make sure the folder structure is preserved:
     - `vercel.json` at the top level
     - `api/bikereg.js`
     - `api/bikesignup.js`
     - `public/index.html`
3. Scroll down and click **Commit changes**

Your files are now saved in GitHub. ✅

---

## Step 4 — Create a free Vercel account

1. Go to **https://vercel.com**
2. Click **Sign Up**
3. Choose **Continue with GitHub** — this links Vercel to your GitHub account directly
4. Authorize Vercel when GitHub asks

---

## Step 5 — Import your project into Vercel

1. After signing up you'll land on your Vercel dashboard
2. Click **Add New → Project**
3. You'll see a list of your GitHub repositories — find `ridentx` and click **Import**
4. On the configuration page:
   - **Framework Preset**: leave as `Other`
   - **Root Directory**: leave as `/` (the default)
   - Everything else can stay as-is
5. Click **Deploy**

Vercel will build and deploy your site. This takes about 60 seconds.

---

## Step 6 — Visit your live site 🎉

When the deploy finishes, Vercel gives you a URL like:

```
https://ridentx.vercel.app
```

Click it. Your site is live, pulling real events from BikeReg and BikeSignUp.

Vercel also gives you a free custom subdomain. If you want a proper domain like
`ridentx.com` or `northtexascycling.com`, you can add it in Vercel's settings for
the cost of domain registration (~$12/year via Namecheap or Google Domains).

---

## How updates work going forward

Whenever you want to update the site (new design, new resource listings, etc.):

1. Claude generates updated files
2. You go to your GitHub repo
3. Click the file you want to replace → click the pencil ✏️ icon → paste new content → commit
   **OR** drag new files into the repo uploader
4. Vercel automatically detects the change and redeploys within ~30 seconds

No commands. No terminal. Just file uploads.

---

## How the data refreshes

| Source | Refresh rate | How |
|---|---|---|
| BikeReg events | Every 1 hour | Vercel edge cache auto-expires |
| BikeSignUp events | Every 1 hour | Vercel edge cache auto-expires |
| Map markers | On page load | Pulled from freshly cached data |

The APIs are free and don't require API keys for public event searches.
If either API goes down, the site gracefully falls back to sample data.

---

## Troubleshooting

**Site shows sample data instead of live events**
- Check that your Vercel deploy succeeded (no red errors in the dashboard)
- Visit `https://your-site.vercel.app/api/bikereg` directly — you should see JSON
- If you see an error, check the Vercel dashboard → Functions tab for logs

**Vercel can't find my files**
- Make sure `vercel.json` is at the top level of the repo, not inside a subfolder
- The `api/` and `public/` folders must be siblings of `vercel.json`

**I want to add a custom domain**
- In Vercel dashboard → your project → Settings → Domains
- Add your domain and follow the DNS instructions (usually takes 10–30 minutes)

---

## Questions?

Bring any issues back to Claude — paste the error message and we'll fix it together.
