// Vercel Serverless Function: Pull from LMCache and regenerate leaderboard
import { exec } from 'child_process';
import { promisify } from 'util';
import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';
import { extractTarball } from './_lib/extractTarball.js';
import { CommitAnalyzer } from './_lib/analyzeCommitsGithub.js';

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

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const REPO_OWNER = process.env.REPO_OWNER || 'cdc542559455';
    const REPO_NAME = process.env.REPO_NAME || 'lmcache-leaderboard';

    // DEBUG: Log token presence and partial value
    console.log('🔑 [DEBUG] GITHUB_TOKEN present:', !!GITHUB_TOKEN);
    if (GITHUB_TOKEN) {
      console.log('🔑 [DEBUG] Token length:', GITHUB_TOKEN.length);
      console.log('🔑 [DEBUG] Token starts with:', GITHUB_TOKEN.substring(0, 7) + '...');
      console.log('🔑 [DEBUG] Token ends with: ...' + GITHUB_TOKEN.substring(GITHUB_TOKEN.length - 4));
    }
    console.log('🔑 [DEBUG] REPO_OWNER:', REPO_OWNER);
    console.log('🔑 [DEBUG] REPO_NAME:', REPO_NAME);

    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured');
    }

    if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
      console.warn('⚠️ No AI API keys configured - will use fallback scoring');
    }

    console.log('🔧 [DEBUG] Initializing Octokit with token...');
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Download the tarball of the LMCache repository
    console.log('📥 Downloading LMCache repository tarball...');
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
    console.log(`📌 Latest commit: ${latestCommit}`);

    // Create temp directory and extract tarball
    const tmpDir = '/tmp/lmcache-refresh';
    const lmcacheRepoPath = path.join(tmpDir, 'LMCache');
    await execAsync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}`);

    console.log('📦 Extracting repository tarball...');
    await extractTarball(tarballData, lmcacheRepoPath);
    console.log('✅ Extracted LMCache repository');

    // Download existing leaderboard data for incremental update
    console.log('📥 Downloading existing leaderboard data...');
    let existingData = null;
    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'dashboard/public/leaderboard-data.json',
      });
      const content = Buffer.from(currentFile.content, 'base64').toString('utf-8');
      existingData = JSON.parse(content);
      console.log(`✅ Found existing data with ${existingData.total_commits_analyzed} commits`);
    } catch (error) {
      console.log('⚠️ No existing data found, will do full analysis');
    }

    // Generate leaderboard data with AI analysis using GitHub API
    // Always use 2-day incremental update
    const daysToAnalyze = 2;
    console.log(`🔄 Analyzing last ${daysToAnalyze} day(s) of commits...`);

    const analyzer = new CommitAnalyzer(GITHUB_TOKEN, OPENAI_API_KEY);
    const newData = await analyzer.analyze('LMCache', 'LMCache', daysToAnalyze);

    // Merge with existing data if available
    let data;
    if (existingData) {
      console.log('🔀 Merging new commits with existing data...');
      data = analyzer.mergeData(existingData, newData);
      console.log(`✅ Merged data: ${data.total_commits_analyzed} total commits`);
    } else {
      console.log('⚠️ No existing data found - using 2-day window only');
      data = newData;
      console.log('✅ Leaderboard data generated');
    }

    const leaderboardData = JSON.stringify(data, null, 2);

    // Upload to GitHub repository
    // Update leaderboard-data.json in dashboard/public/
    const filePath = 'dashboard/public/leaderboard-data.json';

    console.log('📤 [DEBUG] Attempting to update file in GitHub...');
    console.log('📤 [DEBUG] Target repo:', `${REPO_OWNER}/${REPO_NAME}`);
    console.log('📤 [DEBUG] File path:', filePath);

    let sha;
    try {
      console.log('🔍 [DEBUG] Fetching existing file to get SHA...');
      const { data: currentFile } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: filePath,
      });
      sha = currentFile.sha;
      console.log('✅ [DEBUG] Found existing file, SHA:', sha?.substring(0, 10) + '...');
    } catch (error) {
      console.log('⚠️ [DEBUG] File not found (will create new):', error.message);
      sha = undefined;
    }

    console.log('📝 [DEBUG] Calling createOrUpdateFileContents...');
    console.log('📝 [DEBUG] Request params:', JSON.stringify({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: `Manual refresh: Update leaderboard data - ${new Date().toISOString()}`,
      sha: sha,
      contentLength: leaderboardData.length
    }, null, 2));

    try {
      const updateResponse = await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: filePath,
        message: `Manual refresh: Update leaderboard data - ${new Date().toISOString()}`,
        content: Buffer.from(leaderboardData).toString('base64'),
        sha: sha,
      });
      console.log('✅ [DEBUG] File update successful! Response:', JSON.stringify({
        commit: updateResponse.data.commit?.sha?.substring(0, 10),
        content: updateResponse.data.content?.sha?.substring(0, 10)
      }));
    } catch (updateError) {
      console.error('❌ [DEBUG] File update FAILED!');
      console.error('❌ [DEBUG] Error name:', updateError.name);
      console.error('❌ [DEBUG] Error message:', updateError.message);
      console.error('❌ [DEBUG] Error status:', updateError.status);
      console.error('❌ [DEBUG] Error response:', JSON.stringify(updateError.response?.data, null, 2));
      throw updateError;
    }

    // Update last-update.json
    const lastUpdateData = {
      timestamp: new Date().toISOString(),
      latestCommit: latestCommit,
      success: true,
      source: 'manual-refresh-admin-panel'
    };

    console.log('📤 [DEBUG] Updating last-update.json...');
    const lastUpdatePath = 'dashboard/public/last-update.json';
    let lastUpdateSha;
    try {
      console.log('🔍 [DEBUG] Fetching existing last-update.json...');
      const { data: currentFile } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: lastUpdatePath,
      });
      lastUpdateSha = currentFile.sha;
      console.log('✅ [DEBUG] Found last-update.json, SHA:', lastUpdateSha?.substring(0, 10) + '...');
    } catch (error) {
      console.log('⚠️ [DEBUG] last-update.json not found (will create new)');
      lastUpdateSha = undefined;
    }

    try {
      console.log('📝 [DEBUG] Updating last-update.json...');
      await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: lastUpdatePath,
        message: `Manual refresh: Update timestamp - ${new Date().toISOString()}`,
        content: Buffer.from(JSON.stringify(lastUpdateData, null, 2)).toString('base64'),
        sha: lastUpdateSha,
      });
      console.log('✅ [DEBUG] last-update.json updated successfully');
    } catch (lastUpdateError) {
      console.error('❌ [DEBUG] last-update.json update FAILED:', lastUpdateError.message);
      // Don't throw - this is not critical
    }

    console.log(`✅ Manual refresh completed at ${new Date().toISOString()}`);

    // Clean up
    await execAsync(`rm -rf ${tmpDir}`);

    res.status(200).json({
      success: true,
      message: 'Successfully pulled from official LMCache repo and regenerated leaderboard with AI analysis',
      latestCommit: latestCommit,
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
