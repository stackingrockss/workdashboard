# Quick Start Checklist - Google OAuth Setup

Use this checklist to quickly set up Google OAuth authentication for your Opportunity Tracker.

## ☑️ Pre-Setup Verification

Run the verification script to check your local setup:

```bash
npm run verify-auth
```

This will verify that all required files and environment variables are configured.

---

## 📋 Setup Checklist

### 1. Create Supabase Project (5 minutes)

- [ ] Go to [supabase.com/dashboard](https://supabase.com/dashboard)
- [ ] Click "New Project"
- [ ] Fill in project details:
  - Name: `opportunity-tracker`
  - Database password: (generate and save securely)
  - Region: (choose closest to you)
- [ ] Wait for project to be created (~2 minutes)

### 2. Configure Supabase Environment Variables (2 minutes)

- [ ] In Supabase dashboard, go to **Settings** → **API**
- [ ] Copy **Project URL** → Add to `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Copy **anon/public key** → Add to `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Copy **service_role key** → Add to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

Your `.env.local` should look like:
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 3. Set Up Google OAuth (10 minutes)

#### 3.1 Create Google Cloud Project
- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com/)
- [ ] Create new project or select existing one
- [ ] Note your project ID

#### 3.2 Configure OAuth Consent Screen
- [ ] Navigate to **APIs & Services** → **OAuth consent screen**
- [ ] Choose **External** (or Internal for organization)
- [ ] Fill in required fields:
  - App name: `Opportunity Tracker`
  - User support email: (your email)
  - Developer contact: (your email)
- [ ] Click **Save and Continue** (skip optional fields)
- [ ] On **Scopes** page, click **Save and Continue**
- [ ] On **Test users** page (for External), add your email
- [ ] Click **Save and Continue**, then **Back to Dashboard**

#### 3.3 Create OAuth Credentials
- [ ] Go to **APIs & Services** → **Credentials**
- [ ] Click **Create Credentials** → **OAuth client ID**
- [ ] Application type: **Web application**
- [ ] Name: `Opportunity Tracker Web`
- [ ] Under **Authorized redirect URIs**, click **Add URI** and enter:
  ```
  https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
  ```
  Replace `YOUR-PROJECT-REF` with your actual Supabase project reference (from the URL)
- [ ] Click **Create**
- [ ] Copy **Client ID** and **Client Secret** (you'll need these next)

### 4. Connect Google OAuth to Supabase (2 minutes)

- [ ] In Supabase dashboard, go to **Authentication** → **Providers**
- [ ] Find and click on **Google**
- [ ] Toggle **Enable Sign in with Google** to ON
- [ ] Paste **Client ID** from Google Cloud Console
- [ ] Paste **Client Secret** from Google Cloud Console
- [ ] Click **Save**

### 5. Configure Redirect URLs in Supabase (2 minutes)

- [ ] In Supabase dashboard, go to **Authentication** → **URL Configuration**
- [ ] Set **Site URL** to: `http://localhost:3000`
- [ ] Under **Redirect URLs**, add (one per line):
  ```
  http://localhost:3000/auth/callback
  http://localhost:3000
  ```
- [ ] Click **Save**

### 6. Test Your Setup (5 minutes)

- [ ] Run verification script:
  ```bash
  npm run verify-auth
  ```
- [ ] Start your development server:
  ```bash
  npm run dev
  ```
- [ ] Open browser to `http://localhost:3000/auth/login`
- [ ] Click **Continue with Google**
- [ ] Select your Google account
- [ ] Grant permissions
- [ ] Verify you're redirected to `/opportunities`
- [ ] Check your profile in the user menu (top-right corner)
- [ ] Test logout functionality
- [ ] Test sign in again

### 7. Verify Database Sync (2 minutes)

- [ ] In Supabase dashboard, go to **Authentication** → **Users**
- [ ] Confirm your user is listed
- [ ] Check your PostgreSQL database (via Prisma Studio or SQL client)
- [ ] Verify user exists in the `User` table with:
  - ✅ Email matches
  - ✅ Name is populated
  - ✅ `supabaseId` is set
  - ✅ `avatarUrl` is set (if you have a Google profile picture)

---

## 🎉 Success Criteria

Your setup is complete when:

✅ Google sign-in redirects to opportunities page
✅ User profile appears in top-right menu
✅ User data is saved to database
✅ Logout works and redirects to login
✅ Protected routes redirect to login when not authenticated
✅ Sessions persist across page reloads

---

## 🚨 Troubleshooting

### Issue: "Invalid OAuth callback URL"
**Solution:**
1. Check Google Cloud Console → Credentials → Your OAuth Client
2. Verify redirect URI is exactly: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
3. No trailing slashes, no typos

### Issue: "User not found in database"
**Solution:**
1. Check `DATABASE_URL` in `.env.local`
2. Run `npx prisma generate`
3. Check auth callback handler logs in terminal

### Issue: Can't click "Continue with Google"
**Solution:**
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
3. Restart dev server after adding environment variables

### Issue: Redirect loop
**Solution:**
1. Clear browser cookies for localhost
2. Check middleware.ts is configured correctly
3. Verify redirect URLs in Supabase dashboard

---

## 📚 Additional Resources

- **Full Setup Guide:** [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)
- **Implementation Details:** [AUTH_IMPLEMENTATION_SUMMARY.md](./AUTH_IMPLEMENTATION_SUMMARY.md)
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Google OAuth Docs:** https://developers.google.com/identity/protocols/oauth2

---

## 🚀 Production Deployment

When ready to deploy, see the production deployment section in [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md#production-deployment).

Key steps:
1. Add production domain to Google OAuth authorized origins
2. Update Supabase Site URL and Redirect URLs
3. Set environment variables in hosting platform
4. Test authentication on production domain

---

## ✅ Post-Setup: Optional Enhancements

After basic auth is working, consider:

- [ ] Set up email verification for email/password signups
- [ ] Configure Row Level Security (RLS) in Supabase
- [ ] Add rate limiting to auth endpoints
- [ ] Enable Multi-Factor Authentication (MFA)
- [ ] Set up error tracking (Sentry)
- [ ] Configure custom email templates in Supabase
- [ ] Add social login with other providers (GitHub, Microsoft, etc.)

---

**Need help?** Check the troubleshooting section or refer to the detailed guides in the `docs/` folder.
