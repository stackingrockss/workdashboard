# Vercel Deployment - Step-by-Step Fix for 404 Error

## Problem
You're getting: `404: NOT_FOUND` because Vercel can't find your Next.js app.

## Root Cause
Your Next.js app is in the `opportunity-tracker/` subdirectory, not the root of the repository.

## Solution: Configure Root Directory in Vercel

### **CRITICAL STEP - You MUST do this manually in Vercel Dashboard:**

1. **Open your Vercel project**: https://vercel.com/dashboard
2. **Click on** your `workdashboard` project
3. **Click** "Settings" in the top navigation bar
4. **Click** "General" in the left sidebar
5. **Scroll down** to find "Root Directory"
6. **You will see**: `./` (this is WRONG - that's why you get 404)
7. **Click** the "Edit" button next to Root Directory
8. **Type**: `opportunity-tracker`
9. **Click** "Save"
10. **Go to** "Deployments" tab
11. **Click** the three dots (...) on the latest deployment
12. **Click** "Redeploy"

## Verification Checklist

Before redeploying, verify these settings in Vercel:

### ✅ General Settings
- [ ] Root Directory = `opportunity-tracker`
- [ ] Framework Preset = Next.js (should auto-detect)
- [ ] Build Command = `npm run build` (default is fine)
- [ ] Output Directory = `.next` (default is fine)
- [ ] Install Command = `npm install` (default is fine)

### ✅ Environment Variables
Go to Settings → Environment Variables and verify:

- [ ] `DATABASE_URL` is set
  ```
  postgresql://neondb_owner:npg_fLCbNhYl49qO@ep-polished-art-af8y9fux-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require
  ```
- [ ] Variable is set for: Production, Preview, Development (all three)

## What Happens After Setting Root Directory

When you set Root Directory to `opportunity-tracker`, Vercel will:

1. ✅ Navigate to `opportunity-tracker/` first
2. ✅ Find `package.json` there
3. ✅ Find `next.config.ts` there
4. ✅ Run `npm install` in that directory
5. ✅ Run `prisma generate` (from vercel.json)
6. ✅ Run `next build` in that directory
7. ✅ Deploy the `.next` folder
8. ✅ Your app will work! 🎉

## Alternative: Deploy the Subdirectory Directly

If the above doesn't work, you can:

1. Create a NEW Vercel project
2. Point it to: `github.com/stackingrockss/workdashboard`
3. Set Root Directory to: `opportunity-tracker` **during initial setup**
4. This sometimes works better than editing an existing project

## Troubleshooting

### Still Getting 404?
1. **Check build logs**: Go to Deployments → Click on the deployment → View Build Logs
2. **Look for errors** related to:
   - "Could not find Next.js"
   - "No package.json found"
   - File not found errors
3. **Verify** Root Directory is actually saved (refresh the Settings page to confirm)

### Build succeeds but still 404?
1. Check that the deployment URL ends with `/` (root path)
2. Try accessing `/opportunities` directly
3. Check browser console for errors
4. Verify the deployment shows "Ready" status

## Expected Build Output

When configured correctly, you should see:

```
Running "npm install"...
✓ Dependencies installed

Running "prisma generate && next build"...
✓ Prisma Client generated
✓ Creating an optimized production build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Build completed successfully

Deployment Ready!
```

## Need More Help?

If you're still getting 404 after following ALL steps above:

1. Send me a screenshot of your Vercel Settings → General page
2. Send me the build logs from the latest deployment
3. Confirm you've actually clicked "Save" after setting Root Directory

---

**Remember**: The Root Directory setting CANNOT be configured via vercel.json - it MUST be set manually in the Vercel dashboard!
