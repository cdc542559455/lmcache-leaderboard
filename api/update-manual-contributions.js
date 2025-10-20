// Vercel Serverless Function: Update manual contributions
import { Octokit } from '@octokit/rest';

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
    const data = req.body;
    const jsonContent = JSON.stringify(data, null, 2);

    // Use environment variables for GitHub credentials
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.REPO_OWNER || 'LMCache'; // Default to LMCache
    const REPO_NAME = process.env.REPO_NAME || 'lmcache-leaderboard';

    if (!GITHUB_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'GitHub token not configured. Add GITHUB_TOKEN to environment variables.'
      });
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Update manual-contributions.json in the repository
    const filePath = 'manual-contributions.json';

    // Get current file to get its SHA
    let sha;
    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: filePath,
      });
      sha = currentFile.sha;
    } catch (error) {
      // File doesn't exist yet, that's okay
      sha = undefined;
    }

    // Update or create the file
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: `Update manual contributions - ${new Date().toISOString()}`,
      content: Buffer.from(jsonContent).toString('base64'),
      sha: sha,
    });

    console.log('✅ Updated manual-contributions.json in repository');

    res.status(200).json({
      success: true,
      message: 'Manual contributions updated successfully in repository'
    });
  } catch (error) {
    console.error('❌ Error updating manual contributions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
