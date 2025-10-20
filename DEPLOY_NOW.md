# 🚀 Deploy to Vercel - Quick Start

## Your Configuration:
- **GitHub Username**: `cdc542559455`
- **GitHub Token**: `YOUR_GITHUB_TOKEN` (use your personal access token)
- **Repository**: Create new repo `lmcache-leaderboard` under your account

---

## Step 1: Create GitHub Repository (2 minutes)

1. Go to: https://github.com/new
2. Fill in:
   - **Repository name**: `lmcache-leaderboard`
   - **Description**: `LMCache Contributor Leaderboard - Automated rankings`
   - **Visibility**: ✅ Public
   - **Initialize**: ❌ DO NOT check any boxes
3. Click **"Create repository"**

---

## Step 2: Push Code to GitHub (1 minute)

Run these commands:

```bash
cd ~/Desktop/lmcache-leaderboard

# Initialize git
git init

# Add all files
git add .

# Create commit
git commit -m "Initial commit: LMCache Leaderboard with Vercel deployment"

# Add remote
git remote add origin https://github.com/cdc542559455/lmcache-leaderboard.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Vercel (3 minutes)

1. **Go to Vercel**: https://vercel.com/dashboard

2. **Import Project**:
   - Click **"Add New..."** → **"Project"**
   - Click **"Import Git Repository"**
   - Select: `cdc542559455/lmcache-leaderboard`
   - Click **"Import"**

3. **Configure Build Settings**:
   - **Framework Preset**: Vite ✅ (should auto-detect)
   - **Root Directory**: `./`
   - **Build Command**: `cd dashboard && npm install && npm run build`
   - **Output Directory**: `dashboard/dist`
   - **Install Command**: `npm install`

4. **Add Environment Variables** (CRITICAL):

   Click **"Environment Variables"** and add these 3 variables:

   | Name | Value |
   |------|-------|
   | `GITHUB_TOKEN` | `YOUR_GITHUB_TOKEN` |
   | `REPO_OWNER` | `cdc542559455` |
   | `REPO_NAME` | `lmcache-leaderboard` |

   ⚠️ **Make sure to select**: "Production, Preview, and Development" for all 3 variables

5. **Deploy**:
   - Click **"Deploy"**
   - Wait 2-3 minutes
   - ✅ Your site will be live!

---

## Step 4: Test Your Deployment (2 minutes)

Once deployed, Vercel will give you a URL like:
**`https://lmcache-leaderboard.vercel.app`**

### Test these features:

1. **Leaderboard Display** ✅
   - Should show contributor rankings
   - Filter contributors should work
   - Time periods (weekly/monthly/quarterly) should work

2. **Admin Panel** ✅
   - Click "Admin" button (top right)
   - Login with your GitHub account (`cdc542559455`)
   - Should see admin panel

3. **Admin Functions** ✅
   - Click "Export Backup" - should download JSON file
   - Try "Pull from Official Repo" - should refresh data
   - Try adding a manual contribution - should save to GitHub

---

## 🎯 What Happens After Deployment

### ✅ Automatic Updates
- **Hourly refresh**: Vercel Cron will pull from LMCache repo every hour
- **Auto-deploy**: Every push to `main` branch triggers new deployment

### ✅ Admin Panel Functions
- **Save to GitHub**: Updates `manual-contributions.json` in your repo
- **Export**: Downloads backup of manual contributions
- **Pull & Refresh**: Pulls latest from https://github.com/LMCache/LMCache

### ✅ AI Analysis
- The `analyze_commits.py` script runs in Vercel's serverless environment
- Uses Claude API (from your analyze script) to score commits
- Generates `leaderboard-data.json` with all rankings

---

## 🔧 Troubleshooting

### Build Fails
**Check**: Vercel deployment logs
**Common fix**: Make sure `dashboard/package.json` exists

### Admin Panel Not Working
**Check**: Environment variables are set correctly
**Fix**: Go to Project Settings → Environment Variables

### API Errors
**Check**: Browser console (F12)
**Fix**: Verify `GITHUB_TOKEN` has `repo` and `workflow` scopes

---

## 📊 Monitor Your Deployment

### View Logs:
1. Vercel Dashboard → Your Project → **Deployments**
2. Click latest deployment → **Functions** → **cron-refresh**

### Check Last Update:
Visit: `https://your-site.vercel.app/last-update.json`

### Manual Refresh (for testing):
```bash
curl -X POST https://your-site.vercel.app/api/cron-refresh
```

---

## 🎉 You're Done!

Your leaderboard is now:
- ✅ Live on Vercel
- ✅ Auto-updating every hour
- ✅ Full admin panel working
- ✅ AI analysis functional
- ✅ Free hosting forever

**Next Steps**:
1. Share URL with your team
2. Test admin features
3. Monitor hourly updates
4. Transfer to LMCache org when ready

---

## 🆘 Need Help?

- **Vercel Issues**: Check `VERCEL_DEPLOYMENT.md`
- **Admin Problems**: Check `ADMIN_SETUP.md`
- **AI Analysis**: It's the same script running in Vercel's serverless environment

**Ready to deploy?** Follow Step 1 above! 🚀
