// Vercel Serverless Function: Pull from LMCache and regenerate leaderboard
import { exec } from 'child_process';
import { promisify } from 'util';
import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Starting pull and refresh from official LMCache repository...');

    const tmpDir = '/tmp/lmcache-refresh';
    const lmcacheRepoPath = path.join(tmpDir, 'LMCache');

    // Create temp directory
    await execAsync(`mkdir -p ${tmpDir}`);

    // Clone or update LMCache repository
    try {
      await execAsync(`rm -rf ${lmcacheRepoPath}`);
      await execAsync(
        `git clone --depth 1 --branch dev https://github.com/LMCache/LMCache.git ${lmcacheRepoPath}`
      );
      console.log('✅ Cloned official LMCache repository');
    } catch (error) {
      throw new Error(`Failed to clone LMCache repo: ${error.message}`);
    }

    // Get latest commit info
    const { stdout: latestCommit } = await execAsync(
      `cd ${lmcacheRepoPath} && git log -1 --format="%H - %s (%ci)"`
    );

    console.log(`📌 Latest commit: ${latestCommit.trim()}`);

    // Generate leaderboard data with AI analysis
    console.log('🔄 Generating leaderboard data with AI analysis...');

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const REPO_OWNER = process.env.REPO_OWNER || 'cdc542559455';
    const REPO_NAME = process.env.REPO_NAME || 'lmcache-leaderboard';

    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured');
    }

    if (!ANTHROPIC_API_KEY) {
      console.warn('⚠️ ANTHROPIC_API_KEY not configured - AI analysis will be limited');
    }

    const outputPath = path.join(tmpDir, 'leaderboard-data.json');

    // Copy analyze script and requirements to temp dir
    const scriptPath = path.join(tmpDir, 'analyze_commits.py');
    const requirementsPath = path.join(tmpDir, 'requirements.txt');

    const rootDir = process.cwd();
    await execAsync(`cp ${path.join(rootDir, 'analyze_commits.py')} ${scriptPath}`);
    await execAsync(`cp ${path.join(rootDir, 'requirements.txt')} ${requirementsPath}`);

    // Install Python dependencies
    console.log('📦 Installing Python dependencies...');
    await execAsync(`pip install -r ${requirementsPath} --target ${tmpDir}/python_modules`);

    // Run analysis script with Claude API
    console.log('🤖 Running AI-powered commit analysis...');
    const { stdout: analysisOutput } = await execAsync(
      `cd ${tmpDir} && PYTHONPATH=${tmpDir}/python_modules ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} python3 analyze_commits.py --repo ${lmcacheRepoPath} --output ${outputPath}`,
      { timeout: 50000 } // 50 second timeout
    );

    console.log('✅ Leaderboard data generated');

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
      message: `Manual refresh: Update leaderboard data - ${new Date().toISOString()}`,
      content: Buffer.from(leaderboardData).toString('base64'),
      sha: sha,
    });

    // Update last-update.json
    const lastUpdateData = {
      timestamp: new Date().toISOString(),
      latestCommit: latestCommit.trim(),
      success: true,
      source: 'manual-refresh-admin-panel'
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
      message: `Manual refresh: Update timestamp - ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(lastUpdateData, null, 2)).toString('base64'),
      sha: lastUpdateSha,
    });

    console.log(`✅ Manual refresh completed at ${new Date().toISOString()}`);

    // Clean up
    await execAsync(`rm -rf ${tmpDir}`);

    res.status(200).json({
      success: true,
      message: 'Successfully pulled from official LMCache repo and regenerated leaderboard with AI analysis',
      latestCommit: latestCommit.trim(),
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
}
