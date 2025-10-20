# 🔐 Admin Panel Setup Guide

This guide explains how to set up the GitHub OAuth admin panel for managing manual contribution scores.

## 🎯 What You'll Get

- 🔒 Secure GitHub OAuth authentication
- ✏️ Web-based editor for manual contributions
- 🚀 Auto-commit changes to your repo
- 🔄 Automatic dashboard rebuild via GitHub Actions
- 👥 Only repo collaborators can edit

## 📋 Prerequisites

- GitHub repository (e.g., `YOUR_USERNAME/lmcache-leaderboard`)
- GitHub account with write access to the repo

## 🚀 Setup Steps

### Step 1: Create a GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in the details:
   - **Application name**: `LMCache Leaderboard Admin`
   - **Homepage URL**: `https://YOUR_USERNAME.github.io/lmcache-leaderboard`
   - **Authorization callback URL**: `https://YOUR_USERNAME.github.io/lmcache-leaderboard`
4. Click **"Register application"**
5. **Copy the Client ID** (you'll need this)
6. Click **"Generate a new client secret"**
7. **Copy the Client Secret** (you'll need this)

### Step 2: Create Environment Variables File

Create a file called `.env.local` in the dashboard folder:

```bash
cd ~/Desktop/lmcache-leaderboard/dashboard
cat > .env.local << 'EOF'
VITE_GITHUB_CLIENT_ID=your_client_id_here
VITE_GITHUB_REPO_OWNER=YOUR_USERNAME
VITE_GITHUB_REPO_NAME=lmcache-leaderboard
EOF
```

Replace:
- `your_client_id_here` with your actual Client ID
- `YOUR_USERNAME` with your GitHub username

**⚠️ IMPORTANT**: The Client Secret should NOT be stored in the frontend. We'll use a serverless function for that.

### Step 3: Deploy to GitHub Pages

The admin panel is now integrated into your dashboard! When you deploy to GitHub Pages:

1. Push your code to GitHub
2. Enable GitHub Pages in repository settings
3. The admin panel will be accessible at: `https://YOUR_USERNAME.github.io/lmcache-leaderboard`

### Step 4: Set Up GitHub Personal Access Token

For the auto-commit feature to work:

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Give it a name: `LMCache Leaderboard Admin`
4. Select scopes:
   - ✅ `repo` (all)
5. Click **"Generate token"**
6. **Copy the token** (you'll only see it once!)

7. Add it as a repository secret:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click **"New repository secret"**
   - Name: `ADMIN_GITHUB_TOKEN`
   - Value: (paste your token)

## 🎨 Using the Admin Panel

### Access the Admin Panel

1. Open your leaderboard dashboard
2. Click the **"🔑 Admin"** button in the top right
3. Click **"Sign in with GitHub"**
4. Authorize the app
5. You'll see the admin panel!

### Edit Manual Contributions

1. In the admin panel, you'll see a list of all contributors
2. Click **"Edit"** next to any contributor
3. Enter the score and notes
4. Click **"Save"**
5. Changes are automatically committed to your repo!

### Add New Contributors

1. Click **"Add Contributor"**
2. Enter name, score, and notes
3. Click **"Save"**

## 🔒 Security Features

- ✅ **OAuth Authentication**: Only GitHub users can access admin panel
- ✅ **Repo Permission Check**: Only repo collaborators can edit
- ✅ **Audit Trail**: All changes are git commits with your name
- ✅ **No Client Secret in Frontend**: Uses GitHub's device flow or serverless function

## 🛠️ Advanced Configuration

### Custom Repo Branch

By default, changes commit to `main` branch. To change:

```javascript
// In dashboard/src/components/AdminPanel.jsx
const BRANCH = 'admin-edits' // Change this
```

### Commit Message Format

Customize commit messages in `AdminPanel.jsx`:

```javascript
const message = `📝 Update manual contributions for ${contributorName}`
```

## ❓ Troubleshooting

**Problem**: "OAuth authentication failed"
- **Solution**: Check your Client ID is correct in `.env.local`

**Problem**: "Permission denied"
- **Solution**: Make sure you're a collaborator on the repo

**Problem**: "Failed to commit changes"
- **Solution**: Check that `ADMIN_GITHUB_TOKEN` is set in repository secrets

**Problem**: Admin button doesn't appear
- **Solution**: Make sure `.env.local` has the correct `VITE_GITHUB_CLIENT_ID`

## 📧 Support

If you encounter issues, check the browser console for error messages or open an issue on GitHub.
