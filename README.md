# 🏆 LMCache Contributor Leaderboard

A modern, AI-powered leaderboard dashboard that tracks and ranks LMCache contributors based on their commit impact and significance.

## ✨ Features

- **Multi-Factor Commit Classification**: Analyzes commits using LOC, file changes, commit keywords, and AI-based impact assessment
- **Time Period Views**: Toggle between weekly, monthly, and quarterly views
- **Beautiful Dashboard**: Modern UI matching LMCache's color scheme (#5928e5 purple, #a091f5 light purple)
- **Automated Updates**: Daily cronjob via GitHub Actions refreshes data automatically
- **Detailed Insights**: Drill down into individual contributor commits with full scoring breakdown
- **Interactive Charts**: Visualize contribution trends over time

## 🎯 Scoring System

Each commit receives a score from 0-100 points based on:

| Factor | Points | Criteria |
|--------|--------|----------|
| **Lines of Code (LOC)** | 0-30 | Changes: >100=30pts, 50-100=15pts, 20-50=8pts, <20=3pts |
| **Files Changed** | 0-20 | Files: ≥5=20pts, 2-4=10pts, 1=5pts |
| **Commit Keywords** | 0-25 | feat/refactor=25pts, fix=15pts, test/chore=10pts, docs=5pts |
| **AI Impact Analysis** | 0-25 | LLM evaluates architectural impact and complexity |

**Classification Threshold:**
- **Score ≥50**: Significant Change ⭐
- **Score <50**: Simple Fix 🔧

## 🚀 Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Anthropic API key (for AI-based scoring)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/lmcache-leaderboard.git
   cd lmcache-leaderboard
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Node.js dependencies:**
   ```bash
   cd dashboard
   npm install
   cd ..
   ```

4. **Set up environment variables:**
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```

### Running Locally

1. **Clone the LMCache repository:**
   ```bash
   git clone https://github.com/LMCache/LMCache.git
   ```

2. **Generate leaderboard data:**
   ```bash
   python analyze_commits.py --repo ./LMCache --output dashboard/public/leaderboard-data.json
   ```

3. **Start the development server:**
   ```bash
   cd dashboard
   npm run dev
   ```

4. **Open your browser:**
   ```
   http://localhost:5173
   ```

### Building for Production

```bash
cd dashboard
npm run build
```

The built files will be in `dashboard/dist/`.

## 🤖 GitHub Actions Setup

The leaderboard automatically updates daily via GitHub Actions.

### Setup Steps:

1. **Add Anthropic API key to repository secrets:**
   - Go to your repository settings
   - Navigate to Secrets and variables → Actions
   - Add a new secret: `ANTHROPIC_API_KEY`

2. **Enable GitHub Pages:**
   - Go to Settings → Pages
   - Source: GitHub Actions
   - The workflow will automatically deploy after each update

3. **Manual trigger (optional):**
   ```bash
   # Trigger workflow manually from Actions tab
   # or push to main branch
   ```

## 📊 Data Structure

The generated `leaderboard-data.json` contains:

```json
{
  "last_updated": "2025-01-19T00:00:00Z",
  "total_commits_analyzed": 500,
  "analysis_period_days": 180,
  "leaderboards": {
    "weekly": {
      "2025-W03": [
        {
          "rank": 1,
          "name": "Contributor Name",
          "email": "email@example.com",
          "total_commits": 42,
          "significant_commits": 35,
          "simple_commits": 7,
          "significance_ratio": 0.83,
          "total_score": 2450,
          "avg_score": 58.3,
          "commits": [...]
        }
      ]
    },
    "monthly": {...},
    "quarterly": {...}
  }
}
```

## 🎨 Customization

### Colors (matching LMCache brand):

```css
--lm-black: #111;
--lm-purple: #5928e5;
--lm-purple-light: #a091f5;
--lm-orange: #ff8342;
--lm-blue: #0050bd;
```

### Scoring Weights:

Edit `analyze_commits.py` and adjust the scoring methods:
- `calculate_loc_score()`: LOC thresholds
- `calculate_files_score()`: File count thresholds
- `calculate_keyword_score()`: Commit message keywords
- `calculate_ai_score()`: AI prompt and scoring

## 📝 Analysis Period

Default: Last 180 days (6 months)

To change, modify the `--days` parameter:
```bash
python analyze_commits.py --repo ./LMCache --output data.json
# Or edit the default in analyze_commits.py: get_commits_since(days=180)
```

## 🔧 Troubleshooting

### Missing data file:
```bash
# Ensure leaderboard-data.json exists in dashboard/public/
ls dashboard/public/leaderboard-data.json
```

### API key issues:
```bash
# Check if API key is set
echo $ANTHROPIC_API_KEY
```

### Build failures:
```bash
# Clear cache and reinstall
cd dashboard
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📄 License

MIT License - feel free to use and modify for your own projects!

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

---

**Made with 💜 for the LMCache community**
