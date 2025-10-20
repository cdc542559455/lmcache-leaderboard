# 🚀 Vercel Deployment Guide

Complete guide to deploy the LMCache Leaderboard to Vercel with full admin panel functionality and hourly auto-refresh.

---

## ✨ What You'll Get

✅ **Fully functional admin panel** (save to GitHub, export, pull & refresh)
✅ **Automatic hourly updates** (Vercel Cron)
✅ **Serverless API** (no server costs)
✅ **Free hosting** (Vercel free tier)
✅ **Custom domain** (optional)
✅ **HTTPS enabled** by default

---

## 📋 Prerequisites

- ✅ GitHub account
- ✅ Vercel account (already registered)
- ✅ GitHub Personal Access Token with `repo` and `workflow` scopes

---

## 🎯 Step-by-Step Deployment

### Step 1: Create GitHub Repository

1. **Initialize Git** (if not already done):
```bash
cd ~/Desktop/lmcache-leaderboard
git init
```

2. **Create `.gitignore`** (already done ✅)

3. **Commit all files**:
```bash
git add .
git commit -m "Initial commit: LMCache Contributor Leaderboard

- React + Vite dashboard with orange theme
- Admin panel with GitHub OAuth
- Serverless API functions for Vercel
- Hourly auto-refresh with Vercel Cron
- Manual contributions support
- Export/backup functionality
"
```

4. **Create repository on GitHub**:
   - Go to: https://github.com/new
   - **Repository name**: `lmcache-leaderboard`
   - **Description**: `LMCache Contributor Leaderboard - Automated rankings with hourly updates`
   - **Visibility**: Public (required for free Vercel deployment)
   - **DO NOT** initialize with README, .gitignore, or license (you already have these)
   - Click **Create repository**

5. **Push to GitHub**:
```bash
# Replace YOUR_GITHUB_USERNAME with your actual username
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/lmcache-leaderboard.git
git branch -M main
git push -u origin main
```

---

### Step 2: Deploy to Vercel

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Import Project**:
   - Click **"Add New..."** → **"Project"**
   - Select **"Import Git Repository"**
   - Choose your GitHub repository: `YOUR_GITHUB_USERNAME/lmcache-leaderboard`
   - Click **"Import"**

3. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave as is)
   - **Build Command**: `cd dashboard && npm install && npm run build`
   - **Output Directory**: `dashboard/dist`
   - **Install Command**: Leave default or use: `npm install && cd dashboard && npm install`

4. **Add Environment Variables** (CRITICAL):
   Click **"Environment Variables"** and add these:

   | Name | Value | Notes |
   |------|-------|-------|
   | `GITHUB_TOKEN` | `YOUR_GITHUB_TOKEN` | Your GitHub personal access token |
   | `REPO_OWNER` | `YOUR_GITHUB_USERNAME` | Your GitHub username |
   | `REPO_NAME` | `lmcache-leaderboard` | Repository name |

   **Important**: Make sure to select **"All Environments"** (Production, Preview, Development)

5. **Deploy**:
   - Click **"Deploy"**
   - Wait 2-3 minutes for deployment
   - You'll see your URL: `https://lmcache-leaderboard.vercel.app`

---

### Step 3: Enable Vercel Cron (Hourly Auto-Refresh)

**Note**: Vercel Cron is only available on **Pro plans** or with **Hobby plan** if enabled.

1. **Go to Project Settings**:
   - Your project → **Settings** → **Cron Jobs**

2. **Verify Cron Configuration**:
   - Cron jobs are automatically configured from `vercel.json`
   - You should see: `/api/cron-refresh` running every hour (`0 * * * *`)

3. **If Cron is not available** (Hobby plan limitation):
   - **Option A**: Upgrade to Vercel Pro ($20/month)
   - **Option B**: Use GitHub Actions instead (see GitHub Pages guide)
   - **Option C**: Use external cron service (e.g., cron-job.org) to call `/api/cron-refresh`

---

### Step 4: Test Your Deployment

1. **Visit your site**: `https://lmcache-leaderboard.vercel.app`

2. **Test Leaderboard**:
   - ✅ Should see contributor rankings
   - ✅ Filter contributors should work
   - ✅ Time period selection should work

3. **Test Admin Panel**:
   - Click **"Admin"** button (top right)
   - Login with your GitHub account
   - Verify you can see the admin panel

4. **Test Admin Functions**:
   - ✅ **Export Backup**: Should download `manual-contributions-backup-YYYY-MM-DD.json`
   - ✅ **Add New Contributor**: Try adding a test contributor
   - ✅ **Pull from Official Repo**: Should trigger refresh (may take 30-60 seconds)

---

### Step 5: Set Up Custom Domain (Optional)

If you want to use `leaderboard.lmcache.ai`:

1. **Add Domain in Vercel**:
   - Project → **Settings** → **Domains**
   - Enter: `leaderboard.lmcache.ai`
   - Click **Add**

2. **Configure DNS** (in your domain provider):
   ```
   Type: CNAME
   Name: leaderboard
   Value: cname.vercel-dns.com
   TTL: 3600
   ```

3. **Wait for DNS propagation** (5-10 minutes)

4. **Verify HTTPS**: Vercel automatically provisions SSL certificate

---

## 🔧 Configuration Details

### Environment Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| `GITHUB_TOKEN` | Allows Vercel to update your repository | `ghp_xxx...` |
| `REPO_OWNER` | Your GitHub username | `YourUsername` |
| `REPO_NAME` | Repository name | `lmcache-leaderboard` |

### API Endpoints (Vercel Serverless Functions)

All API endpoints are automatically available at `/api/*`:

- `POST /api/update-manual-contributions` - Save manual contributions to GitHub
- `GET /api/export-manual-contributions` - Export backup
- `POST /api/pull-and-refresh` - Pull from LMCache and regenerate
- `POST /api/cron-refresh` - Hourly auto-refresh (Vercel Cron only)

### Auto-Refresh Schedule

- **Frequency**: Every hour (at :00 minutes)
- **Defined in**: `vercel.json` → `crons` array
- **Function**: `/api/cron-refresh`
- **What it does**:
  1. Clones latest LMCache repository
  2. Runs `analyze_commits.py`
  3. Uploads `leaderboard-data.json` to GitHub
  4. Updates `last-update.json` timestamp

---

## 🔒 Security Notes

### Credentials Protection

✅ **GitHub token is safe** - Stored as Vercel environment variable
✅ **Never in code** - Protected by `.gitignore`
✅ **Only accessible by serverless functions** - Not exposed to frontend

### Admin Access Control

- Admin panel uses GitHub OAuth
- Authorized admins defined in `AdminPanel.jsx` line 6-8
- Current authorized: `lokichen3@gmail.com`, `cdc542559455`

To add more admins, edit the `AUTHORIZED_ADMINS` array.

---

## 🐛 Troubleshooting

### Deployment Fails

**Check**:
1. Vercel deployment logs (click on failed deployment)
2. Verify `dashboard/` directory exists
3. Verify `package.json` exists in `dashboard/`

**Common Issues**:
- `npm install` fails → Check `dashboard/package.json` dependencies
- Build fails → Check `dashboard/src/` files for syntax errors

### Admin Panel Not Working

**Check**:
1. Environment variables are set correctly in Vercel
2. `GITHUB_TOKEN` has `repo` and `workflow` scopes
3. Check browser console for API errors

### API Functions Timeout

**Issue**: Vercel free tier has 10-second function timeout

**Solutions**:
- Keep functions fast (under 10 seconds)
- Use GitHub Actions for heavy processing
- Upgrade to Vercel Pro for 60-second timeout

### Cron Not Running

**Issue**: Vercel Cron requires Pro plan or special access

**Solutions**:
1. **Upgrade to Pro** ($20/month)
2. **Use GitHub Actions** (see `GITHUB_PAGES_DEPLOYMENT.md`)
3. **External cron service** (free):
   - Register at https://cron-job.org
   - Create job: `https://your-site.vercel.app/api/cron-refresh` every hour

---

## 📊 Monitoring

### Check Auto-Refresh Status

1. **View Logs**:
   - Vercel Dashboard → Your Project → **Deployments**
   - Click on latest deployment → **Functions** → **cron-refresh**

2. **Check Last Update**:
   - Visit: `https://your-site.vercel.app/last-update.json`
   - Should show recent timestamp if auto-refresh is working

3. **Manual Trigger** (for testing):
   ```bash
   curl -X POST https://your-site.vercel.app/api/cron-refresh
   ```

---

## 🔄 Updating Your Deployment

### Update Code

```bash
# Make changes to your code
git add .
git commit -m "Update: description of changes"
git push
```

Vercel automatically redeploys on push to `main` branch.

### Update Environment Variables

1. Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Edit or add variables
3. Click **Save**
4. Trigger new deployment: **Deployments** → **Redeploy**

### Force Refresh Data

1. **Via Admin Panel**: Click "Pull from Official Repo"
2. **Via API**:
   ```bash
   curl -X POST https://your-site.vercel.app/api/cron-refresh
   ```

---

## 🎉 You're Live!

Your leaderboard is now:
- ✅ Deployed to Vercel
- ✅ Accessible at: `https://lmcache-leaderboard.vercel.app`
- ✅ Auto-updating every hour (if Cron enabled)
- ✅ Full admin panel with GitHub integration
- ✅ Secure credential storage
- ✅ Free hosting forever

### Next Steps

1. **Share the URL** with your team
2. **Test admin features** thoroughly
3. **Set up custom domain** (optional)
4. **Monitor auto-refresh** logs
5. **Transfer to LMCache org** when ready

### Transfer to LMCache Organization (Future)

When ready to transfer:

1. GitHub Settings → Transfer ownership
2. Update `REPO_OWNER` in Vercel to `LMCache`
3. Redeploy

---

## 📞 Support

- **Vercel Docs**: https://vercel.com/docs
- **GitHub Issues**: Create an issue in your repository
- **Admin Problems**: Check `ADMIN_SETUP.md`

---

**Enjoy your automated contributor leaderboard!** 🚀
