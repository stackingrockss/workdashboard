# Google OAuth Authentication Setup Guide

This guide walks you through setting up Google OAuth authentication for your Opportunity Tracker application using Supabase.

## Prerequisites

- A Supabase account ([sign up here](https://supabase.com))
- A Google Cloud Platform account
- Your application running locally or deployed

## Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in:
   - Project name: `opportunity-tracker` (or your preferred name)
   - Database password: (generate a strong password and save it)
   - Region: Choose closest to your users
4. Click "Create new project" and wait for setup to complete (~2 minutes)

## Step 2: Get Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → **anon/public** → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API keys** → **service_role** → This is your `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

3. Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 3: Configure Google OAuth Provider

### 3.1 Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - User Type: External (for testing) or Internal (for organization use)
   - App name: `Opportunity Tracker`
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue** through the remaining steps
6. Return to **Credentials** → **Create Credentials** → **OAuth client ID**
7. Application type: **Web application**
8. Name: `Opportunity Tracker`
9. Add **Authorized redirect URIs**:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
   Replace `your-project-ref` with your actual Supabase project reference
10. Click **Create**
11. Copy the **Client ID** and **Client Secret**

### 3.2 Add Google Provider to Supabase

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list and click to expand
3. Enable the **Google** provider
4. Paste your **Google Client ID** and **Google Client Secret**
5. Click **Save**

## Step 4: Configure Redirect URLs

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Add your site URLs:
   - **Site URL**: `http://localhost:3000` (for local development)
   - **Redirect URLs**: Add the following URLs (one per line):
     ```
     http://localhost:3000/auth/callback
     http://localhost:3000
     https://your-production-domain.com/auth/callback
     https://your-production-domain.com
     ```

## Step 5: Test Authentication Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/auth/login`

3. Click **Continue with Google**

4. You should be redirected to Google's OAuth consent screen

5. After authorizing, you'll be redirected back to your app at `/opportunities`

6. Check your user menu in the top-right corner - you should see your Google profile

## Step 6: Verify Database Sync

After signing in with Google, verify that your user was created in the database:

1. Check your Supabase dashboard under **Authentication** → **Users**
2. You should see your Google account listed
3. The user should also be synced to your Prisma database (check the `User` table)

## Troubleshooting

### "Invalid OAuth callback URL"
- Verify the redirect URI in Google Cloud Console matches exactly: `https://your-project-ref.supabase.co/auth/v1/callback`
- Check for trailing slashes or typos

### "User not found in database"
- Check your database connection string in `.env.local`
- Verify Prisma schema is up to date: `npx prisma generate`
- Check the auth callback handler logs in your console

### "Session not persisting"
- Clear your browser cookies
- Verify middleware is correctly configured in `middleware.ts`
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

### "Redirect not working"
- Verify all redirect URLs are configured in Supabase → Authentication → URL Configuration
- Check that your Google OAuth authorized redirect URIs include the Supabase callback URL

## Production Deployment

When deploying to production:

1. Update your Google OAuth credentials:
   - Add production redirect URI: `https://your-production-domain.com`
   - Add Supabase callback (already configured)

2. Update Supabase URL configuration:
   - Add your production domain to **Site URL**
   - Add production callback URL to **Redirect URLs**

3. Set environment variables in your hosting platform (Vercel, etc.):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   NEXT_PUBLIC_APP_URL=https://your-production-domain.com
   DATABASE_URL=your-production-database-url
   ```

## Security Notes

- ✅ **Never commit** `.env.local` or any file containing secrets
- ✅ **Keep** `SUPABASE_SERVICE_ROLE_KEY` secret (never expose to client)
- ✅ **Use HTTPS** in production (required for OAuth)
- ✅ **Rotate keys** if they're ever exposed
- ✅ **Configure** email domains in Google OAuth consent screen if you want to restrict access

## Additional Features

### Email/Password Authentication
The app also supports traditional email/password sign-in. Users can:
- Sign up with email and password
- Sign in with email and password
- Switch between Google and email/password authentication

### Session Management
- Sessions are automatically refreshed via middleware
- Users are redirected to login when sessions expire
- Auth state is synced across tabs using Supabase's built-in listener

### User Roles
The application supports role-based access control:
- `ADMIN`: Full access to all features
- `MANAGER`: Can manage team opportunities
- `REP`: Can manage own opportunities
- `VIEWER`: Read-only access

Roles can be assigned in the database via the `User.role` field.

## Need Help?

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth Setup](https://support.google.com/cloud/answer/6158849)