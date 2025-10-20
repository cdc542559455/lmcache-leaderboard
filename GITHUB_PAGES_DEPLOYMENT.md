# GitHub Pages Deployment Guide

This guide explains how to deploy the LMCache Leaderboard to GitHub Pages with automatic hourly updates.

## 🔒 Security First: No Credentials in Code!

All sensitive information is stored securely as GitHub Secrets. **NEVER commit credentials to the repository.**

Files already protected by `.gitignore`:
- `.env`, `.env.local`, `.env.production`
- `*.pem`, `*.key`, `*_credentials.json`
- `github_token.txt`, `admin-list.json`

---

## 📋 Prerequisites

1. GitHub account
2. Repository created on GitHub
3. Manual contributions file ready (if you have any)

---

## 🚀 Step-by-Step Deployment

### Step 1: Create a GitHub Repository

```bash
# If you haven't initialized git yet
cd ~/Desktop/lmcache-leaderboard
git init
git add .
git commit -m "Initial commit: LMCache leaderboard"

# Create a new repository on GitHub (via web browser):
# Go to https://github.com/new
# Repository name: lmcache-leaderboard
# Description: LMCache Contributor Leaderboard
# Public repository (required for free GitHub Pages)
# Don't initialize with README (you already have files)

# Link your local repo to GitHub
git remote add origin https://github.com/YOUR_USERNAME/lmcache-leaderboard.git
git branch -M main
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top right)
3. Click **Pages** (left sidebar)
4. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
5. Click **Save**

### Step 3: Set Up GitHub Secrets (Optional - for Admin Panel)

If you want to use the Admin Panel with GitHub authentication:

1. Go to your repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets (if needed for your use case):

#### For GitHub OAuth Admin Access (Optional):
- Name: `ADMIN_GITHUB_TOKEN`
- Value: Your GitHub Personal Access Token
  - Go to https://github.com/settings/tokens
  - Click "Generate new token (classic)"
  - Scopes needed: `read:user`, `user:email`
  - Copy the token and paste it as the secret value

**Note**: For the static GitHub Pages deployment, admin features work client-side with users providing their own tokens through the UI. Server-side features (like the Express API) are not available on GitHub Pages.

### Step 4: Configure Repository Name

Edit `dashboard/vite.config.js` and update the repository name if different:

```javascript
base: process.env.GITHUB_PAGES ? '/lmcache-leaderboard/' : './',
```

Change `/lmcache-leaderboard/` to `/YOUR_REPO_NAME/` if you used a different name.

**For custom domain**: Change to `'/'` instead:
```javascript
base: process.env.GITHUB_PAGES ? '/' : './',
```

### Step 5: Push and Deploy

```bash
# Make sure all files are committed
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
```

### Step 6: Monitor Deployment

1. Go to your repository on GitHub
2. Click **Actions** tab
3. You should see the "Deploy to GitHub Pages" workflow running
4. Wait for it to complete (usually 2-3 minutes)
5. Your site will be live at: `https://YOUR_USERNAME.github.io/lmcache-leaderboard/`

---

## ⏰ Automatic Updates

The leaderboard automatically refreshes **every hour** using GitHub Actions:

- **Workflow**: `.github/workflows/auto-refresh.yml`
- **Schedule**: Every hour at minute 0 (e.g., 1:00, 2:00, 3:00...)
- **What it does**:
  1. Pulls latest commits from official LMCache repository
  2. Generates fresh leaderboard data
  3. Rebuilds and redeploys the website
  4. Updates `last-update.json` timestamp

### Manual Refresh

You can also trigger a manual refresh:

1. Go to **Actions** tab
2. Select "Auto-Refresh Leaderboard" workflow
3. Click **Run workflow** button
4. Select branch `main`
5. Click **Run workflow**

---

## 🌐 Custom Domain Setup (Optional)

If you want to use a custom domain (e.g., `leaderboard.lmcache.ai`):

### Step 1: Update Vite Config

Edit `dashboard/vite.config.js`:

```javascript
base: '/',  // Change from '/lmcache-leaderboard/' to '/'
```

### Step 2: Add CNAME File

Create `dashboard/public/CNAME`:

```
leaderboard.lmcache.ai
```

### Step 3: Configure DNS

Add a CNAME record in your DNS provider:

```
Type: CNAME
Name: leaderboard
Value: YOUR_USERNAME.github.io
```

### Step 4: Enable in GitHub Settings

1. Go to **Settings** → **Pages**
2. Under "Custom domain", enter: `leaderboard.lmcache.ai`
3. Click **Save**
4. Wait for DNS check (can take a few minutes)
5. Enable **Enforce HTTPS** (recommended)

---

## 🔧 Troubleshooting

### Build Fails

**Check logs**:
1. Go to **Actions** tab
2. Click on the failed workflow run
3. Expand failed steps to see error messages

**Common issues**:
- Python dependencies missing → Check `requirements.txt`
- Node dependencies missing → Check `dashboard/package.json`
- LMCache repo clone fails → Check network/GitHub API limits

### Site Shows 404

**Check**:
1. **Settings** → **Pages**: Verify source is "GitHub Actions"
2. **Actions** tab: Verify deployment succeeded
3. Vite config: Check `base` path matches your repo name

### Styles/Assets Not Loading

**Likely cause**: Wrong `base` path in `vite.config.js`

**Fix**:
```javascript
// For GitHub Pages with repo name
base: '/lmcache-leaderboard/',

// For custom domain
base: '/',
```

### Auto-Refresh Not Working

**Check**:
1. **Actions** tab: Verify "Auto-Refresh Leaderboard" workflow exists
2. Workflow permissions: May need to enable in **Settings** → **Actions** → **General**
3. Enable "Read and write permissions" for GITHUB_TOKEN

---

## 📊 Manual Contributions

To add manual contributions (for non-code contributors):

1. Edit `manual-contributions.json` locally
2. Commit and push:
   ```bash
   git add manual-contributions.json
   git commit -m "Update manual contributions"
   git push
   ```
3. GitHub Actions will automatically regenerate the leaderboard

---

## 🔒 Admin Panel on GitHub Pages

**Important**: The Admin Panel features requiring a backend server (Express API) will **NOT work** on GitHub Pages because it only hosts static files.

**What works**:
- ✅ Viewing the leaderboard
- ✅ Filtering contributors
- ✅ Time-period selection
- ✅ Auto-refresh status display

**What doesn't work on GitHub Pages**:
- ❌ Admin Panel server-side features (saving contributions to GitHub)
- ❌ "Pull from Official Repo" button
- ❌ Export API endpoint

**Solutions**:
1. **Edit manual-contributions.json directly** and commit to GitHub
2. **Use Vercel/Netlify** instead if you need the full admin panel with API
3. **Keep admin panel** for local development only

---

## 📝 Updating Content

### Update Leaderboard Logic

Edit `analyze_commits.py` → Commit → Push → Auto-deploys

### Update Dashboard UI

Edit files in `dashboard/src/` → Commit → Push → Auto-deploys

### Change Refresh Frequency

Edit `.github/workflows/auto-refresh.yml`:

```yaml
schedule:
  - cron: '0 * * * *'  # Every hour
  # - cron: '0 */2 * * *'  # Every 2 hours
  # - cron: '0 0 * * *'  # Daily at midnight
  # - cron: '*/30 * * * *'  # Every 30 minutes
```

---

## 📞 Support

- **Documentation**: See `README.md`, `QUICKSTART.md`
- **Issues**: Open an issue on GitHub
- **Manual contributions**: See `MANUAL_CONTRIBUTIONS_GUIDE.md`

---

## 🎉 You're Done!

Your leaderboard is now:
- ✅ Deployed to GitHub Pages
- ✅ Auto-updating every hour
- ✅ Secure (no credentials in code)
- ✅ Free to host forever

**Your URL**: `https://YOUR_USERNAME.github.io/lmcache-leaderboard/`

Enjoy your automated contributor leaderboard! 🚀
