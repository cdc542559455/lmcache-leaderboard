// Vercel Cron Job: Daily leaderboard refresh
// This function is triggered by Vercel Cron daily at midnight UTC
import { exec } from 'child_process';
import { promisify } from 'util';
import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';
import { extractTarball } from './_lib/extractTarball.js';
import { CommitAnalyzer } from './_lib/analyzeCommitsGithub.js';

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

    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Download the tarball of the LMCache repository using GitHub API
    console.log('📥 [CRON] Downloading LMCache repository tarball...');
    const { data: tarballData } = await octokit.repos.downloadTarballArchive({
      owner: 'LMCache',
      repo: 'LMCache',
      ref: 'dev'
    });

    // Get latest commit info using GitHub API
    const { data: latestCommitData } = await octokit.repos.getCommit({
      owner: 'LMCache',
      repo: 'LMCache',
      ref: 'dev'
    });

    const latestCommit = `${latestCommitData.sha.substring(0, 7)} - ${latestCommitData.commit.message.split('\n')[0]} (${latestCommitData.commit.committer.date})`;
    console.log(`📌 [CRON] Latest commit: ${latestCommit}`);

    // Clean and create temp directory
    await execAsync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}`);

    // Extract tarball using pure JavaScript
    console.log('📦 [CRON] Extracting repository tarball...');
    await extractTarball(tarballData, lmcacheRepoPath);
    console.log('✅ [CRON] Extracted LMCache repository');

    // Generate leaderboard data with AI analysis using GitHub API
    console.log('🔄 [CRON] Generating leaderboard data with AI analysis...');

    const analyzer = new CommitAnalyzer(GITHUB_TOKEN, OPENAI_API_KEY);
    const data = await analyzer.analyze('LMCache', 'LMCache', 180); // Last 180 days

    console.log('✅ [CRON] Leaderboard data generated');

    const leaderboardData = JSON.stringify(data, null, 2);

    // Upload to GitHub repository
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
      latestCommit: latestCommit,
      success: true,
      source: 'vercel-cron-daily'
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

    console.log(`✅ [CRON] Daily refresh completed at ${new Date().toISOString()}`);

    // Clean up
    await execAsync(`rm -rf ${tmpDir}`);

    res.status(200).json({
      success: true,
      message: 'Daily refresh completed',
      timestamp: new Date().toISOString(),
      latestCommit: latestCommit
    });

  } catch (error) {
    console.error('❌ [CRON] Daily refresh failed:', error);

    // Try to log the error to GitHub
    try {
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
      if (GITHUB_TOKEN) {
        const octokit = new Octokit({ auth: GITHUB_TOKEN });
        const errorData = {
          timestamp: new Date().toISOString(),
          error: error.message,
          success: false,
          source: 'vercel-cron-daily'
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
