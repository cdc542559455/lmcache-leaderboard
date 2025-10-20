import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { CommitAnalyzer } from '../api/_lib/analyzeCommitsGithub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Endpoint to update manual-contributions.json
app.post('/api/update-manual-contributions', (req, res) => {
  try {
    const data = req.body;
    const jsonContent = JSON.stringify(data, null, 2);

    // Write to BOTH locations to keep them in sync
    // 1. ROOT file (used by analyze_commits.py)
    const rootPath = path.join(__dirname, '..', 'manual-contributions.json');
    fs.writeFileSync(rootPath, jsonContent);

    // 2. Public file (served by Vite for admin panel to read)
    const publicPath = path.join(__dirname, 'public', 'manual-contributions.json');
    fs.writeFileSync(publicPath, jsonContent);

    console.log('✅ Updated manual-contributions.json in both locations');

    // 3. Automatically regenerate leaderboard data
    console.log('🔄 Regenerating leaderboard data...');
    const projectRoot = path.join(__dirname, '..');
    const outputPath = path.join(__dirname, 'public', 'leaderboard-data.json');

    try {
      execSync(
        `python3 analyze_commits.py --repo ./LMCache --output ${outputPath}`,
        {
          cwd: projectRoot,
          stdio: 'pipe'
        }
      );
      console.log('✅ Leaderboard data regenerated successfully');
      res.json({ success: true, message: 'Files updated and leaderboard regenerated' });
    } catch (analysisError) {
      console.error('⚠️ Analysis script failed:', analysisError.message);
      res.json({
        success: true,
        message: 'Files updated but leaderboard regeneration failed',
        warning: analysisError.message
      });
    }
  } catch (error) {
    console.error('❌ Error updating files:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to export manual-contributions.json
app.get('/api/export-manual-contributions', (req, res) => {
  try {
    const publicPath = path.join(__dirname, 'public', 'manual-contributions.json');

    // Check if file exists
    if (!fs.existsSync(publicPath)) {
      return res.status(404).json({
        success: false,
        error: 'manual-contributions.json not found'
      });
    }

    // Read the file
    const fileContent = fs.readFileSync(publicPath, 'utf8');
    const data = JSON.parse(fileContent);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="manual-contributions-backup-${new Date().toISOString().split('T')[0]}.json"`);

    res.json(data);
    console.log('✅ Manual contributions exported successfully');
  } catch (error) {
    console.error('❌ Error exporting manual contributions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to force pull from official LMCache repo and regenerate leaderboard
app.post('/api/pull-and-refresh', async (req, res) => {
  try {
    const outputPath = path.join(__dirname, 'public', 'leaderboard-data.json');

    console.log('🔄 Starting refresh from official LMCache repository using GitHub API...');

    // Use GitHub API-based analyzer (no git/Python required)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    const analyzer = new CommitAnalyzer(GITHUB_TOKEN, OPENAI_API_KEY);
    const data = await analyzer.analyze('LMCache', 'LMCache', 180); // Last 180 days

    console.log('✅ Analysis complete - writing to file...');

    // Write the data to file
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    // Update last-update.json
    const lastUpdatePath = path.join(__dirname, 'public', 'last-update.json');
    const lastUpdateData = {
      timestamp: new Date().toISOString(),
      latestCommit: `GitHub API analysis completed`,
      success: true,
      source: 'local-api-manual-refresh',
      contributorsAnalyzed: data.contributors?.length || 0
    };
    fs.writeFileSync(lastUpdatePath, JSON.stringify(lastUpdateData, null, 2));

    console.log(`✅ Leaderboard data regenerated successfully - ${data.contributors?.length || 0} contributors`);

    res.json({
      success: true,
      message: 'Successfully analyzed LMCache repo and regenerated leaderboard',
      timestamp: new Date().toISOString(),
      contributorsAnalyzed: data.contributors?.length || 0
    });
  } catch (error) {
    console.error('❌ Error during pull and refresh:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auto-refresh function that runs periodically
let autoRefreshInterval = null;
let lastAutoRefresh = null;

const performAutoRefresh = async () => {
  try {
    console.log('\n⏰ [AUTO-REFRESH] Starting scheduled refresh from official LMCache repository...');

    const outputPath = path.join(__dirname, 'public', 'leaderboard-data.json');
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (OPENAI_API_KEY) {
      console.log('🤖 [AUTO-REFRESH] Using OpenAI for commit analysis');
    } else {
      console.warn('⚠️ [AUTO-REFRESH] No AI API keys - using fallback scoring');
    }

    // Load existing data for incremental update
    let existingData = null;
    try {
      const existingContent = fs.readFileSync(outputPath, 'utf-8');
      existingData = JSON.parse(existingContent);
      console.log(`📥 [AUTO-REFRESH] Found existing data with ${existingData.total_commits_analyzed} commits`);
    } catch (error) {
      console.log('⚠️ [AUTO-REFRESH] No existing data found, will do full analysis');
    }

    // Use GitHub API-based analyzer (no git/Python required)
    const analyzer = new CommitAnalyzer(GITHUB_TOKEN, OPENAI_API_KEY);

    // Use incremental update (2 days) if existing data exists, otherwise full 365 days
    const daysToAnalyze = existingData ? 2 : 365;
    console.log(`🔄 [AUTO-REFRESH] Analyzing last ${daysToAnalyze} day(s) of commits...`);

    const newData = await analyzer.analyze('LMCache', 'LMCache', daysToAnalyze);

    // Merge with existing data if doing incremental update
    let data;
    if (existingData && daysToAnalyze === 2) {
      console.log('🔀 [AUTO-REFRESH] Merging new commits with existing data...');
      data = analyzer.mergeData(existingData, newData);
      console.log(`✅ [AUTO-REFRESH] Merged data: ${data.total_commits_analyzed} total commits`);
    } else {
      data = newData;
      console.log(`✅ [AUTO-REFRESH] Analysis complete - ${data.total_commits_analyzed} commits analyzed`);
    }

    // Write the data to file
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    lastAutoRefresh = new Date().toISOString();

    // Save last update info
    const lastUpdatePath = path.join(__dirname, 'public', 'last-update.json');
    fs.writeFileSync(lastUpdatePath, JSON.stringify({
      timestamp: lastAutoRefresh,
      latestCommit: `GitHub API analysis completed`,
      success: true,
      source: 'auto-refresh',
      contributorsAnalyzed: data.contributors?.length || 0
    }, null, 2));

    console.log(`✅ [AUTO-REFRESH] Completed successfully at ${lastAutoRefresh}`);
  } catch (error) {
    console.error(`❌ [AUTO-REFRESH] Failed:`, error.message);

    // Save error info
    const lastUpdatePath = path.join(__dirname, 'public', 'last-update.json');
    fs.writeFileSync(lastUpdatePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      error: error.message,
      success: false,
      source: 'auto-refresh'
    }, null, 2));
  }
};

// Start auto-refresh interval (every 15 minutes = 15 * 60 * 1000 ms)
const startAutoRefresh = () => {
  const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

  console.log('🔄 Starting auto-refresh interval (every 15 minutes)');

  // Run immediately on startup (after 30 seconds to let server stabilize)
  setTimeout(() => {
    performAutoRefresh();
  }, 30000);

  // Then run every 15 minutes
  autoRefreshInterval = setInterval(() => {
    performAutoRefresh();
  }, REFRESH_INTERVAL);
};

app.listen(PORT, () => {
  console.log(`🚀 Local API server running on http://localhost:${PORT}`);
  console.log('📝 Ready to receive manual contribution updates');
  console.log('🔄 Ready to pull from official LMCache repository');

  // Start the auto-refresh interval
  startAutoRefresh();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    console.log('✅ Auto-refresh interval cleared');
  }
  process.exit(0);
});
