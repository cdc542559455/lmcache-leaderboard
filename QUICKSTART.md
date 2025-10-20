# ⚡ Quick Start Guide

Get the LMCache leaderboard running in 5 minutes!

## 🎯 Option 1: Test with Sample Data (Fastest)

```bash
cd ~/Desktop/lmcache-leaderboard/dashboard

# Copy sample data
cp public/leaderboard-data.sample.json public/leaderboard-data.json

# Install and run
npm install
npm run dev
```

Open http://localhost:5173 - you'll see a working dashboard with sample data!

## 🔥 Option 2: Automated Setup (Recommended)

```bash
cd ~/Desktop/lmcache-leaderboard

# Optional: Set API key for AI scoring
export ANTHROPIC_API_KEY="your-api-key"

# Run everything automatically
./run-local.sh
```

This script will:
1. Clone LMCache repository
2. Install Python dependencies
3. Run commit analysis
4. Install Node dependencies
5. Start dev server

## 📊 Option 3: Manual Step-by-Step

```bash
cd ~/Desktop/lmcache-leaderboard

# 1. Clone LMCache repo
git clone https://github.com/LMCache/LMCache.git

# 2. Install Python deps
pip install -r requirements.txt

# 3. Run analysis (optional: set ANTHROPIC_API_KEY)
python analyze_commits.py --repo ./LMCache --output dashboard/public/leaderboard-data.json

# 4. Install Node deps
cd dashboard
npm install

# 5. Start dev server
npm run dev
```

## 🚀 Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push your code:
   ```bash
   cd ~/Desktop/lmcache-leaderboard
   git init
   git add .
   git commit -m "Initial commit: LMCache leaderboard"
   git remote add origin https://github.com/YOUR_USERNAME/lmcache-leaderboard.git
   git push -u origin main
   ```

3. Add GitHub secret:
   - Go to Settings → Secrets and variables → Actions
   - Add `ANTHROPIC_API_KEY`

4. Enable GitHub Pages:
   - Go to Settings → Pages
   - Source: GitHub Actions

5. The dashboard will auto-deploy and update daily at midnight UTC!

## 🎨 What You'll See

- **📈 Stats Cards**: Total commits, significant/simple breakdown, contributors
- **📊 Trend Charts**: Line charts showing commit patterns over time
- **🏆 Leaderboard Table**: Ranked contributors with scores
- **🔍 Drill-Down**: Click any row to see individual commits with full details
- **⏱️ Time Filters**: Switch between Weekly/Monthly/Quarterly views

## 🐛 Troubleshooting

**Port 5173 already in use?**
```bash
# Kill the process or change port
npm run dev -- --port 3000
```

**Missing leaderboard-data.json?**
```bash
# Use sample data
cp dashboard/public/leaderboard-data.sample.json dashboard/public/leaderboard-data.json
```

**Python dependencies fail?**
```bash
# Use a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 🎉 You're Done!

The dashboard is running at http://localhost:5173

Enjoy tracking LMCache contributions! 🏆
