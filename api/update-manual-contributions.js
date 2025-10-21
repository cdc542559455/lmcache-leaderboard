// Vercel Serverless Function: Update manual contributions directly in leaderboard-data.json
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
    const requestData = req.body;
    const contributors = requestData.contributors || {};

    console.log(`🔄 Updating manual contributions for ${Object.keys(contributors).length} contributors...`);

    // Use environment variables for GitHub credentials (trim to remove any whitespace/newlines)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
    const REPO_OWNER = (process.env.REPO_OWNER || 'cdc542559455').trim();
    const REPO_NAME = (process.env.REPO_NAME || 'lmcache-leaderboard').trim();

    if (!GITHUB_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'GitHub token not configured. Add GITHUB_TOKEN to environment variables.'
      });
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Download existing leaderboard data
    const leaderboardPath = 'dashboard/public/leaderboard-data.json';
    let leaderboardData;
    let leaderboardSha;

    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: leaderboardPath,
      });
      const content = Buffer.from(currentFile.content, 'base64').toString('utf-8');
      leaderboardData = JSON.parse(content);
      leaderboardSha = currentFile.sha;
      console.log('✅ Loaded existing leaderboard data');
    } catch (error) {
      console.error('❌ Failed to load leaderboard data:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to load leaderboard data from repository'
      });
    }

    // Helper function to check if a date falls within a week
    const dateInWeek = (date, weekKey) => {
      const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
      if (!match) return false;

      const year = parseInt(match[1]);
      const week = parseInt(match[2]);

      // Calculate Monday of this ISO week using UTC to avoid timezone issues
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const week1Monday = new Date(jan4);
      week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

      const weekMonday = new Date(week1Monday);
      weekMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

      const weekSunday = new Date(weekMonday);
      weekSunday.setUTCDate(weekMonday.getUTCDate() + 6);
      weekSunday.setUTCHours(23, 59, 59, 999);

      const checkDate = new Date(date + 'T00:00:00Z');
      return checkDate >= weekMonday && checkDate <= weekSunday;
    };

    // Update ONLY weekly data with manual contributions
    const weeklyData = leaderboardData.leaderboards.weekly || {};

    for (const [weekKey, contributorsList] of Object.entries(weeklyData)) {
      for (let i = 0; i < contributorsList.length; i++) {
        const contributor = contributorsList[i];
        const manualContrib = contributors[contributor.name];

        if (manualContrib && manualContrib.contributions) {
          const weekContributions = manualContrib.contributions.filter(c => {
            if (!c.start_date) return false;
            return dateInWeek(c.start_date, weekKey);
          });

          if (weekContributions.length > 0) {
            const additionalScore = weekContributions.reduce((sum, c) => sum + (c.score || 0), 0);
            const additionalNotes = weekContributions.map(c => c.notes).filter(Boolean).join('; ');

            contributorsList[i] = {
              ...contributor,
              additional_contribution_score: additionalScore,
              additional_contributions: weekContributions,
              additional_contribution_notes: additionalNotes,
              total_score: (contributor.commit_score || 0) + additionalScore
            };

            console.log(`  ✓ Updated ${contributor.name} in week ${weekKey}: +${additionalScore} points`);
          } else {
            // Reset if no contributions for this week
            contributorsList[i] = {
              ...contributor,
              additional_contribution_score: 0,
              additional_contributions: [],
              additional_contribution_notes: '',
              total_score: contributor.commit_score || 0
            };
          }
        } else {
          // Reset if contributor not in manual contributions
          contributorsList[i] = {
            ...contributor,
            additional_contribution_score: 0,
            additional_contributions: [],
            additional_contribution_notes: '',
            total_score: contributor.commit_score || 0
          };
        }
      }
    }

    // Recalculate monthly and quarterly by summing weekly data
    console.log('🔄 Recalculating monthly and quarterly from weekly data...');

    const aggregateFromWeekly = (periodType) => {
      const result = {};

      for (const [weekKey, weekContributors] of Object.entries(weeklyData)) {
        const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
        if (!match) continue;

        const year = parseInt(match[1]);
        const week = parseInt(match[2]);

        const jan4 = new Date(year, 0, 4);
        const jan4Day = jan4.getDay() || 7;
        const week1Monday = new Date(jan4);
        week1Monday.setDate(jan4.getDate() - jan4Day + 1);

        const weekMonday = new Date(week1Monday);
        weekMonday.setDate(week1Monday.getDate() + (week - 1) * 7);

        let periodKey;
        if (periodType === 'monthly') {
          const month = (weekMonday.getMonth() + 1).toString().padStart(2, '0');
          periodKey = `${weekMonday.getFullYear()}-${month}`;
        } else {
          const quarter = Math.floor(weekMonday.getMonth() / 3) + 1;
          periodKey = `${weekMonday.getFullYear()}-Q${quarter}`;
        }

        if (!result[periodKey]) result[periodKey] = {};

        for (const contributor of weekContributors) {
          if (!result[periodKey][contributor.name]) {
            result[periodKey][contributor.name] = {
              name: contributor.name,
              email: contributor.email,
              total_commits: 0,
              significant_commits: 0,
              simple_commits: 0,
              commit_score: 0,
              additional_contribution_score: 0,
              additional_contributions: [],
              commits: []
            };
          }

          const agg = result[periodKey][contributor.name];
          agg.total_commits += contributor.total_commits || 0;
          agg.significant_commits += contributor.significant_commits || 0;
          agg.simple_commits += contributor.simple_commits || 0;
          agg.commit_score += contributor.commit_score || 0;
          agg.additional_contribution_score += contributor.additional_contribution_score || 0;
          if (contributor.additional_contributions) {
            agg.additional_contributions.push(...contributor.additional_contributions);
          }
          if (contributor.commits) {
            agg.commits.push(...contributor.commits);
          }
        }
      }

      const periodData = {};
      for (const [periodKey, contributorsMap] of Object.entries(result)) {
        periodData[periodKey] = Object.values(contributorsMap).map(c => ({
          ...c,
          total_score: c.commit_score + c.additional_contribution_score,
          significance_ratio: c.total_commits > 0 ? c.significant_commits / c.total_commits : 0,
          avg_score: c.total_commits > 0 ? Math.round(c.commit_score / c.total_commits) : 0
        })).sort((a, b) => b.total_score - a.total_score);
      }

      return periodData;
    };

    leaderboardData.leaderboards.monthly = aggregateFromWeekly('monthly');
    leaderboardData.leaderboards.quarterly = aggregateFromWeekly('quarterly');

    // Upload updated leaderboard data back to GitHub
    console.log('📤 Uploading updated leaderboard data...');
    const updatedContent = JSON.stringify(leaderboardData, null, 2);

    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: leaderboardPath,
      message: `Update manual contributions - ${new Date().toISOString()}`,
      content: Buffer.from(updatedContent).toString('base64'),
      sha: leaderboardSha,
    });

    console.log('✅ Manual contributions updated successfully!');

    res.status(200).json({
      success: true,
      message: 'Manual contributions saved successfully! Refresh the page to see changes.'
    });
  } catch (error) {
    console.error('❌ Error updating manual contributions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
