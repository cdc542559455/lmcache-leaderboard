// Vercel Cron Job: Hourly leaderboard refresh
// This function is triggered by Vercel Cron every hour
import { exec } from 'child_process';
import { promisify } from 'util';
import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  // Verify this is a cron request from Vercel
  if (req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('⏰ [CRON] Starting scheduled leaderboard refresh...');

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const REPO_OWNER = process.env.REPO_OWNER || 'cdc542559455';
    const REPO_NAME = process.env.REPO_NAME || 'lmcache-leaderboard';

    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured');
    }

    if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
      console.warn('⚠️ [CRON] No AI API keys configured - will use fallback scoring');
    }

    const tmpDir = '/tmp/lmcache-cron';
    const lmcacheRepoPath = path.join(tmpDir, 'LMCache');
    const outputPath = path.join(tmpDir, 'leaderboard-data.json');

    // Clean and create temp directory
    await execAsync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}`);

    // Clone LMCache repository
    console.log('📥 [CRON] Cloning LMCache repository...');
    await execAsync(
      `git clone --depth 1 --branch dev https://github.com/LMCache/LMCache.git ${lmcacheRepoPath}`
    );

    // Get latest commit info
    const { stdout: latestCommit } = await execAsync(
      `cd ${lmcacheRepoPath} && git log -1 --format="%H - %s (%ci)"`
    );
    console.log(`📌 [CRON] Latest commit: ${latestCommit.trim()}`);

    // Copy analyze script and requirements to temp dir
    const scriptPath = path.join(tmpDir, 'analyze_commits.py');
    const requirementsPath = path.join(tmpDir, 'requirements.txt');

    // These need to be in the repo root for Vercel to access
    const rootDir = process.cwd();
    await execAsync(`cp ${path.join(rootDir, 'analyze_commits.py')} ${scriptPath}`);
    await execAsync(`cp ${path.join(rootDir, 'requirements.txt')} ${requirementsPath}`);

    // Install Python dependencies (if not cached)
    console.log('📦 [CRON] Installing Python dependencies...');
    await execAsync(`pip install -r ${requirementsPath} --target ${tmpDir}/python_modules`);

    // Run analysis script with OpenAI/Claude API
    console.log('🔄 [CRON] Generating leaderboard data with AI analysis...');
    const envVars = `PYTHONPATH=${tmpDir}/python_modules`;
    const apiKeys = [
      OPENAI_API_KEY ? `OPENAI_API_KEY=${OPENAI_API_KEY}` : '',
      ANTHROPIC_API_KEY ? `ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}` : ''
    ].filter(Boolean).join(' ');

    const { stdout: analysisOutput } = await execAsync(
      `cd ${tmpDir} && ${envVars} ${apiKeys} python3 analyze_commits.py --repo ${lmcacheRepoPath} --output ${outputPath}`,
      { timeout: 50000 } // 50 second timeout
    );

    console.log('✅ [CRON] Leaderboard data generated');

    // Read generated data
    const leaderboardData = await fs.readFile(outputPath, 'utf-8');
    const data = JSON.parse(leaderboardData);

    // Upload to GitHub repository
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Update leaderboard-data.json in dashboard/public/
    const filePath = 'dashboard/public/leaderboard-data.json';

    let sha;
    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: filePath,
      });
      sha = currentFile.sha;
    } catch (error) {
      sha = undefined;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: `Auto-refresh leaderboard data - ${new Date().toISOString()}`,
      content: Buffer.from(leaderboardData).toString('base64'),
      sha: sha,
    });

    // Update last-update.json
    const lastUpdateData = {
      timestamp: new Date().toISOString(),
      latestCommit: latestCommit.trim(),
      success: true,
      source: 'vercel-cron-hourly'
    };

    const lastUpdatePath = 'dashboard/public/last-update.json';
    let lastUpdateSha;
    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: lastUpdatePath,
      });
      lastUpdateSha = currentFile.sha;
    } catch (error) {
      lastUpdateSha = undefined;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: lastUpdatePath,
      message: `Update last-refresh timestamp - ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(lastUpdateData, null, 2)).toString('base64'),
      sha: lastUpdateSha,
    });

    console.log(`✅ [CRON] Hourly refresh completed at ${new Date().toISOString()}`);

    // Clean up
    await execAsync(`rm -rf ${tmpDir}`);

    res.status(200).json({
      success: true,
      message: 'Hourly refresh completed',
      timestamp: new Date().toISOString(),
      latestCommit: latestCommit.trim()
    });

  } catch (error) {
    console.error('❌ [CRON] Hourly refresh failed:', error);

    // Try to log the error to GitHub
    try {
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
      if (GITHUB_TOKEN) {
        const octokit = new Octokit({ auth: GITHUB_TOKEN });
        const errorData = {
          timestamp: new Date().toISOString(),
          error: error.message,
          success: false,
          source: 'vercel-cron-hourly'
        };

        await octokit.repos.createOrUpdateFileContents({
          owner: process.env.REPO_OWNER || 'LMCache',
          repo: process.env.REPO_NAME || 'lmcache-leaderboard',
          path: 'dashboard/public/last-update.json',
          message: `Cron refresh failed - ${new Date().toISOString()}`,
          content: Buffer.from(JSON.stringify(errorData, null, 2)).toString('base64'),
        });
      }
    } catch (logError) {
      console.error('Failed to log error to GitHub:', logError);
    }

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
