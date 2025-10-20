#!/bin/bash
# Setup script for creating GitHub repository and pushing to GitHub

set -e

echo "🚀 LMCache Leaderboard - GitHub Setup"
echo "======================================"
echo ""

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
  echo "❌ GitHub username is required"
  exit 1
fi

REPO_NAME="lmcache-leaderboard"

echo ""
echo "📋 Configuration:"
echo "  GitHub Username: $GITHUB_USERNAME"
echo "  Repository Name: $REPO_NAME"
echo "  Repository URL: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
echo ""

read -p "Continue? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "📝 Step 1: Initializing Git repository..."
git init

echo "✅ Git initialized"
echo ""

echo "📝 Step 2: Adding all files..."
git add .

echo "✅ Files staged"
echo ""

echo "📝 Step 3: Creating initial commit..."
git commit -m "Initial commit: LMCache Contributor Leaderboard

- React + Vite dashboard with orange theme
- Admin panel with GitHub OAuth
- Serverless API functions for Vercel
- Hourly auto-refresh with Vercel Cron
- Manual contributions support
- Export/backup functionality
- Flat Material Design icons
- Contributor filtering
- Time-period selection (weekly/monthly/quarterly)
"

echo "✅ Initial commit created"
echo ""

echo "📝 Step 4: Adding GitHub remote..."
git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

echo "✅ Remote added"
echo ""

echo "📝 Step 5: Renaming branch to main..."
git branch -M main

echo "✅ Branch renamed"
echo ""

echo "🎯 Next Steps:"
echo ""
echo "1. Create the repository on GitHub:"
echo "   👉 https://github.com/new"
echo ""
echo "   Settings:"
echo "   - Repository name: $REPO_NAME"
echo "   - Description: LMCache Contributor Leaderboard - Automated rankings with hourly updates"
echo "   - Visibility: Public"
echo "   - DO NOT initialize with README, .gitignore, or license"
echo ""
echo "2. After creating the repository, run:"
echo "   git push -u origin main"
echo ""
echo "3. Then follow VERCEL_DEPLOYMENT.md to deploy to Vercel"
echo ""

read -p "Press Enter to open GitHub in your browser..."
open "https://github.com/new"

echo ""
echo "✅ Setup complete! Repository ready to push."
echo ""
