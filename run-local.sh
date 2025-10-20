#!/bin/bash

set -e

echo "🏆 LMCache Leaderboard - Local Setup"
echo "===================================="
echo

# Check if LMCache repo exists
if [ ! -d "LMCache" ]; then
    echo "📥 Cloning LMCache repository..."
    git clone https://github.com/LMCache/LMCache.git
    echo "✅ LMCache repository cloned"
    echo
fi

# Check Python dependencies
echo "🐍 Checking Python dependencies..."
if ! pip show anthropic &> /dev/null; then
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
fi
echo "✅ Python dependencies ready"
echo

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set!"
    echo "   AI scoring will use fallback heuristics."
    echo "   To use AI scoring, set: export ANTHROPIC_API_KEY='your-key'"
    echo
fi

# Run analysis
echo "📊 Running commit analysis..."
mkdir -p dashboard/public
python analyze_commits.py --repo ./LMCache --output dashboard/public/leaderboard-data.json
echo "✅ Analysis complete!"
echo

# Check Node dependencies
echo "📦 Checking Node.js dependencies..."
cd dashboard
if [ ! -d "node_modules" ]; then
    echo "🔨 Installing Node.js dependencies..."
    npm install
fi
echo "✅ Node.js dependencies ready"
echo

# Start dev server
echo "🚀 Starting development server..."
echo "   Dashboard will be available at: http://localhost:5173"
echo
npm run dev
