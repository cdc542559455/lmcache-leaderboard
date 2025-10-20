import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
    const projectRoot = path.join(__dirname, '..');
    const lmcacheRepoPath = path.join(projectRoot, 'LMCache');
    const outputPath = path.join(__dirname, 'public', 'leaderboard-data.json');

    console.log('🔄 Starting force pull from official LMCache repository...');

    // Check if LMCache directory exists
    if (!fs.existsSync(lmcacheRepoPath)) {
      console.log('📥 LMCache repo not found locally, cloning from official repo...');
      try {
        execSync(
          'git clone https://github.com/LMCache/LMCache.git',
          {
            cwd: projectRoot,
            stdio: 'pipe'
          }
        );
        console.log('✅ Cloned official LMCache repository');
      } catch (cloneError) {
        throw new Error(`Failed to clone LMCache repo: ${cloneError.message}`);
      }
    } else {
      // Pull latest changes from official repo
      console.log('🔄 Pulling latest changes from official LMCache repository...');
      try {
        // Fetch from official remote (default branch is 'dev' for LMCache)
        execSync(
          'git fetch https://github.com/LMCache/LMCache.git dev',
          {
            cwd: lmcacheRepoPath,
            stdio: 'pipe'
          }
        );

        // Reset to match official repo (force pull)
        execSync(
          'git reset --hard FETCH_HEAD',
          {
            cwd: lmcacheRepoPath,
            stdio: 'pipe'
          }
        );

        console.log('✅ Pulled latest changes from official LMCache repository');
      } catch (pullError) {
        throw new Error(`Failed to pull from LMCache repo: ${pullError.message}`);
      }
    }

    // Get the latest commit info
    const latestCommit = execSync(
      'git log -1 --format="%H - %s (%ci)"',
      {
        cwd: lmcacheRepoPath,
        encoding: 'utf8'
      }
    ).trim();

    console.log(`📌 Latest commit: ${latestCommit}`);

    // Regenerate leaderboard data with fresh repo data
    console.log('🔄 Regenerating leaderboard data with fresh repository data...');
    try {
      const analysisOutput = execSync(
        `python3 analyze_commits.py --repo ./LMCache --output ${outputPath}`,
        {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        }
      );

      console.log('✅ Leaderboard data regenerated successfully');

      res.json({
        success: true,
        message: 'Successfully pulled from official LMCache repo and regenerated leaderboard',
        latestCommit: latestCommit,
        timestamp: new Date().toISOString()
      });
    } catch (analysisError) {
      throw new Error(`Analysis script failed: ${analysisError.message}`);
    }
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

    const projectRoot = path.join(__dirname, '..');
    const lmcacheRepoPath = path.join(projectRoot, 'LMCache');
    const outputPath = path.join(__dirname, 'public', 'leaderboard-data.json');

    // Check if LMCache directory exists
    if (!fs.existsSync(lmcacheRepoPath)) {
      console.log('📥 [AUTO-REFRESH] LMCache repo not found, skipping auto-refresh');
      return;
    }

    // Fetch from official remote (default branch is 'dev' for LMCache)
    execSync(
      'git fetch https://github.com/LMCache/LMCache.git dev',
      {
        cwd: lmcacheRepoPath,
        stdio: 'pipe'
      }
    );

    // Reset to match official repo (force pull)
    execSync(
      'git reset --hard FETCH_HEAD',
      {
        cwd: lmcacheRepoPath,
        stdio: 'pipe'
      }
    );

    // Get the latest commit info
    const latestCommit = execSync(
      'git log -1 --format="%H - %s (%ci)"',
      {
        cwd: lmcacheRepoPath,
        encoding: 'utf8'
      }
    ).trim();

    console.log(`📌 [AUTO-REFRESH] Latest commit: ${latestCommit}`);

    // Regenerate leaderboard data with OpenAI API
    const env = { ...process.env };

    if (env.OPENAI_API_KEY) {
      console.log('🤖 [AUTO-REFRESH] Using OpenAI for commit analysis');
    } else if (env.ANTHROPIC_API_KEY) {
      console.log('🤖 [AUTO-REFRESH] Using Anthropic for commit analysis');
    } else {
      console.warn('⚠️ [AUTO-REFRESH] No AI API keys - using fallback scoring');
    }

    execSync(
      `python3 analyze_commits.py --repo ./LMCache --output ${outputPath}`,
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        env: env
      }
    );

    lastAutoRefresh = new Date().toISOString();

    // Save last update info
    const lastUpdatePath = path.join(__dirname, 'public', 'last-update.json');
    fs.writeFileSync(lastUpdatePath, JSON.stringify({
      timestamp: lastAutoRefresh,
      latestCommit: latestCommit,
      success: true,
      source: 'auto-refresh'
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
