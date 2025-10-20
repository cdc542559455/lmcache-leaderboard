// Vercel Serverless Function: Export manual contributions
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

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.REPO_OWNER || 'LMCache';
    const REPO_NAME = process.env.REPO_NAME || 'lmcache-leaderboard';

    if (!GITHUB_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'GitHub token not configured'
      });
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Fetch manual-contributions.json from repository
    const { data: file } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'manual-contributions.json',
    });

    const content = Buffer.from(file.content, 'base64').toString('utf-8');
    const data = JSON.parse(content);

    // Set download headers
    const filename = `manual-contributions-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.status(200).json(data);
    console.log('✅ Manual contributions exported successfully');
  } catch (error) {
    console.error('❌ Error exporting manual contributions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
