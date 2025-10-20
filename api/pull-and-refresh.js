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

    // Generate leaderboard data
    console.log('🔄 Generating leaderboard data...');

    // Note: analyze_commits.py needs to be available in the deployment
    // This requires Python to be available in Vercel's environment
    // Vercel supports Python but it's limited - may need to pre-generate data

    res.status(200).json({
      success: true,
      message: 'Successfully pulled from official LMCache repo',
      latestCommit: latestCommit.trim(),
      timestamp: new Date().toISOString(),
      note: 'Data regeneration happens via GitHub Actions workflow'
    });

  } catch (error) {
    console.error('❌ Error during pull and refresh:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
