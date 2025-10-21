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

// Endpoint to update manual-contributions directly in leaderboard-data.json
// Updates weekly data, then recalculates monthly and quarterly by summing
app.post('/api/update-manual-contributions', (req, res) => {
  try {
    const requestData = req.body;
    const contributors = requestData.contributors || {};

    // Load existing leaderboard data
    const leaderboardPath = path.join(__dirname, 'public', 'leaderboard-data.json');
    const leaderboardData = JSON.parse(fs.readFileSync(leaderboardPath, 'utf-8'));

    console.log(`🔄 Updating WEEKLY manual contributions for ${Object.keys(contributors).length} contributors...`);

    // Update ONLY weekly data with manual contributions
    const weeklyData = leaderboardData.leaderboards.weekly || {};

    // Helper function to check if a date falls within a week
    const dateInWeek = (date, weekKey) => {
      const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
      if (!match) return false;

      const year = parseInt(match[1]);
      const week = parseInt(match[2]);

      // Calculate Monday of this ISO week using UTC to avoid timezone issues
      // ISO week 1 is the week containing the first Thursday of the year
      const jan4 = new Date(Date.UTC(year, 0, 4)); // January 4th is always in week 1
      const jan4Day = jan4.getUTCDay() || 7; // Convert Sunday (0) to 7
      const week1Monday = new Date(jan4);
      week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

      // Calculate target week's Monday
      const weekMonday = new Date(week1Monday);
      weekMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

      // Week runs Monday to Sunday
      const weekSunday = new Date(weekMonday);
      weekSunday.setUTCDate(weekMonday.getUTCDate() + 6);

      // Set time to end of Sunday for proper comparison
      weekSunday.setUTCHours(23, 59, 59, 999);

      // Parse input date and set to UTC midnight for comparison
      const checkDate = new Date(date + 'T00:00:00Z');
      return checkDate >= weekMonday && checkDate <= weekSunday;
    };

    // Process each week
    for (const [weekKey, contributorsList] of Object.entries(weeklyData)) {
      for (let i = 0; i < contributorsList.length; i++) {
        const contributor = contributorsList[i];
        const manualContrib = contributors[contributor.name];

        if (manualContrib && manualContrib.contributions) {
          // Filter contributions that fall within this week's date range
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

    // Helper to aggregate weeks into month/quarter
    const aggregateFromWeekly = (periodType) => {
      const result = {};

      for (const [weekKey, weekContributors] of Object.entries(weeklyData)) {
        // Determine which month/quarter this week belongs to
        // Parse ISO week format "YYYY-Www" to get actual calendar period
        const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
        if (!match) continue; // Skip invalid week keys

        const year = parseInt(match[1]);
        const week = parseInt(match[2]);

        // Calculate date for Monday of this ISO week
        // ISO week 1 is the week containing the first Thursday of the year
        const jan4 = new Date(year, 0, 4); // January 4th is always in week 1
        const jan4Day = jan4.getDay() || 7; // Convert Sunday (0) to 7
        const week1Monday = new Date(jan4);
        week1Monday.setDate(jan4.getDate() - jan4Day + 1);

        // Calculate target week's Monday
        const weekMonday = new Date(week1Monday);
        weekMonday.setDate(week1Monday.getDate() + (week - 1) * 7);

        // Determine period key based on the week's Monday date
        let periodKey;
        if (periodType === 'monthly') {
          const month = (weekMonday.getMonth() + 1).toString().padStart(2, '0');
          periodKey = `${weekMonday.getFullYear()}-${month}`;
        } else { // quarterly
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

      // Convert to sorted arrays with calculated fields
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

    // Write updated leaderboard data back to file
    fs.writeFileSync(leaderboardPath, JSON.stringify(leaderboardData, null, 2));

    console.log('✅ Weekly data updated with manual contributions!');
    console.log('✅ Monthly and quarterly recalculated from weekly data!');

    res.json({
      success: true,
      message: 'Manual contributions saved successfully! Refresh the page to see changes.'
    });
  } catch (error) {
    console.error('❌ Error updating leaderboard data:', error);
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

    // Load existing data for incremental update
    let existingData = null;
    try {
      const existingContent = fs.readFileSync(outputPath, 'utf-8');
      existingData = JSON.parse(existingContent);
      console.log(`📥 [PULL-AND-REFRESH] Found existing data with ${existingData.total_commits_analyzed} commits`);
    } catch (error) {
      console.log('⚠️ [PULL-AND-REFRESH] No existing data found, will do full analysis');
    }

    // Always use 2-day incremental update
    const daysToAnalyze = 2;
    console.log(`🔄 [PULL-AND-REFRESH] Analyzing last ${daysToAnalyze} day(s) of commits...`);

    const newData = await analyzer.analyze('LMCache', 'LMCache', daysToAnalyze);

    // Merge with existing data if available
    let data;
    const manualContribPath = path.join(__dirname, 'public', 'manual-contributions.json');
    if (existingData) {
      console.log('🔀 [PULL-AND-REFRESH] Merging new commits with existing data...');
      data = analyzer.mergeData(existingData, newData, manualContribPath);
      console.log(`✅ [PULL-AND-REFRESH] Merged data: ${data.total_commits_analyzed} total commits`);
    } else {
      console.log('⚠️ [PULL-AND-REFRESH] No existing data found - using 2-day window only');
      data = newData;
      console.log(`✅ [PULL-AND-REFRESH] Analysis complete - ${data.total_commits_analyzed} commits analyzed`);
    }

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

    // Always use 2-day incremental update
    const daysToAnalyze = 2;
    console.log(`🔄 [AUTO-REFRESH] Analyzing last ${daysToAnalyze} day(s) of commits...`);

    const newData = await analyzer.analyze('LMCache', 'LMCache', daysToAnalyze);

    // Merge with existing data if available
    let data;
    const manualContribPath = path.join(__dirname, 'public', 'manual-contributions.json');
    if (existingData) {
      console.log('🔀 [AUTO-REFRESH] Merging new commits with existing data...');
      data = analyzer.mergeData(existingData, newData, manualContribPath);
      console.log(`✅ [AUTO-REFRESH] Merged data: ${data.total_commits_analyzed} total commits`);
    } else {
      console.log('⚠️ [AUTO-REFRESH] No existing data found - using 2-day window only');
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
