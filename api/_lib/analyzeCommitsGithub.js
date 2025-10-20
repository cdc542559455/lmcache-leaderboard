// GitHub API-based commit analysis (no git binary required)
import { Octokit } from '@octokit/rest';
import { OpenAI } from 'openai';

export class CommitAnalyzer {
  constructor(githubToken, openaiApiKey = null) {
    this.octokit = new Octokit({ auth: githubToken });
    this.openaiApiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    this.openaiClient = this.openaiApiKey ? new OpenAI({ apiKey: this.openaiApiKey }) : null;
  }

  async getCommitsSince(owner, repo, days = 365) {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    console.log(`Fetching commits from ${owner}/${repo} since ${sinceDate.toISOString()}...`);

    const commits = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data } = await this.octokit.repos.listCommits({
        owner,
        repo,
        since: sinceDate.toISOString(),
        per_page: perPage,
        page
      });

      if (data.length === 0) break;

      for (const commit of data) {
        // Skip merge commits
        if (commit.parents && commit.parents.length > 1) continue;

        commits.push({
          hash: commit.sha,
          authorName: commit.commit.author.name,
          authorEmail: commit.commit.author.email,
          timestamp: new Date(commit.commit.author.date).getTime() / 1000,
          date: new Date(commit.commit.author.date),
          message: commit.commit.message
        });
      }

      if (data.length < perPage) break;
      page++;
    }

    console.log(`Found ${commits.length} commits`);
    return commits;
  }

  async getCommitStats(owner, repo, commitSha) {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: commitSha
      });

      const files = data.files || [];
      const insertions = files.reduce((sum, f) => sum + (f.additions || 0), 0);
      const deletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0);

      return {
        filesChanged: files.length,
        filesList: files.map(f => f.filename),
        insertions,
        deletions,
        totalLines: insertions + deletions,
        diff: data.files ? data.files.map(f => f.patch || '').join('\n').substring(0, 4000) : ''
      };
    } catch (error) {
      console.error(`Error getting stats for ${commitSha}:`, error.message);
      return {
        filesChanged: 0,
        filesList: [],
        insertions: 0,
        deletions: 0,
        totalLines: 0,
        diff: ''
      };
    }
  }

  calculateLocScore(totalLines) {
    if (totalLines >= 100) return 30;
    if (totalLines >= 50) return 15;
    if (totalLines >= 20) return 8;
    return 3;
  }

  calculateFilesScore(filesChanged) {
    if (filesChanged >= 5) return 20;
    if (filesChanged >= 2) return 10;
    return 5;
  }

  calculateKeywordScore(message) {
    const messageLower = message.toLowerCase();

    // High impact
    if (/feat:|feature:|refactor:|perf:|breaking:/.test(messageLower)) return 25;
    // Medium impact
    if (/fix:|bug:|improve:|enhance:|update:/.test(messageLower)) return 15;
    // Low impact
    if (/docs:|doc:|typo:|style:|format:/.test(messageLower)) return 5;
    // Test/chore
    if (/test:|chore:|ci:/.test(messageLower)) return 10;
    // Default
    return 12;
  }

  async calculateAiScore(commitData) {
    if (!this.openaiClient) {
      // Fallback: simple heuristic
      return Math.min(25, Math.floor(commitData.totalLines / 10));
    }

    try {
      const prompt = `Analyze this git commit and rate its significance from 0-25 points.

Commit message: ${commitData.message}
Files changed: ${commitData.filesChanged}
Lines changed: ${commitData.totalLines} (${commitData.insertions}+, ${commitData.deletions}-)

Consider:
- Impact on architecture/design (high=20-25, medium=10-19, low=0-9)
- Bug severity if it's a fix
- Feature complexity
- Code quality improvements

Diff preview:
${commitData.diff.substring(0, 1000)}

Respond with ONLY a number from 0-25.`;

      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0
      });

      const scoreText = response.choices[0].message.content.trim();
      const scoreMatch = scoreText.match(/\d+/);
      const score = scoreMatch ? parseInt(scoreMatch[0]) : 0;
      return Math.min(25, Math.max(0, score));

    } catch (error) {
      console.error('AI scoring failed:', error.message, 'using fallback');
      return Math.min(25, Math.floor(commitData.totalLines / 10));
    }
  }

  async classifyCommit(owner, repo, commit) {
    const stats = await this.getCommitStats(owner, repo, commit.hash);
    const commitData = { ...commit, ...stats };

    // Calculate scores
    const locScore = this.calculateLocScore(stats.totalLines);
    const filesScore = this.calculateFilesScore(stats.filesChanged);
    const keywordScore = this.calculateKeywordScore(commit.message);
    const aiScore = await this.calculateAiScore(commitData);

    const totalScore = locScore + filesScore + keywordScore + aiScore;

    return {
      hash: commit.hash.substring(0, 8),
      author: commit.authorName,
      email: commit.authorEmail,
      date: commit.date.toISOString(),
      message: commit.message,
      stats: {
        files: stats.filesChanged,
        lines: stats.totalLines,
        insertions: stats.insertions,
        deletions: stats.deletions
      },
      scores: {
        loc: locScore,
        files: filesScore,
        keyword: keywordScore,
        ai: aiScore,
        total: totalScore
      },
      significant: totalScore >= 50
    };
  }

  async analyze(owner, repo, daysBack = 365) {
    console.log(`Analyzing ${owner}/${repo} for last ${daysBack} days...`);
    const commits = await this.getCommitsSince(owner, repo, daysBack);

    const classifiedCommits = [];
    const contributorCommits = {};

    let processed = 0;
    for (const commit of commits) {
      const classified = await this.classifyCommit(owner, repo, commit);
      classifiedCommits.push(classified);

      // Store commits by contributor
      const author = classified.author;
      if (!contributorCommits[author]) {
        contributorCommits[author] = {
          name: author,
          email: classified.email,
          commits: []
        };
      }

      contributorCommits[author].commits.push({
        hash: classified.hash,
        author: classified.author,
        email: classified.email,
        date: classified.date,
        message: classified.message,
        stats: classified.stats,
        scores: classified.scores,
        classification: classified.significant ? 'significant' : 'simple'
      });

      processed++;
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${commits.length} commits`);
      }
    }

    // Group commits by time period
    const timePeriods = { weekly: {}, monthly: {}, quarterly: {} };

    for (const commit of classifiedCommits) {
      const date = new Date(commit.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const quarter = Math.ceil((date.getMonth() + 1) / 3);

      // Get ISO week number
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      const weekKey = `${year}-W${String(weekNo).padStart(2, '0')}`;
      const monthKey = `${year}-${month}`;
      const quarterKey = `${year}-Q${quarter}`;

      if (!timePeriods.weekly[weekKey]) timePeriods.weekly[weekKey] = [];
      if (!timePeriods.monthly[monthKey]) timePeriods.monthly[monthKey] = [];
      if (!timePeriods.quarterly[quarterKey]) timePeriods.quarterly[quarterKey] = [];

      timePeriods.weekly[weekKey].push(commit);
      timePeriods.monthly[monthKey].push(commit);
      timePeriods.quarterly[quarterKey].push(commit);
    }

    // Generate leaderboards for each time period
    const leaderboards = {};
    for (const [periodType, periods] of Object.entries(timePeriods)) {
      leaderboards[periodType] = {};

      for (const [periodKey, periodCommits] of Object.entries(periods)) {
        const periodContributors = {};

        // Aggregate stats for this period
        for (const commit of periodCommits) {
          const author = commit.author;
          if (!periodContributors[author]) {
            const authorInfo = contributorCommits[author];
            periodContributors[author] = {
              name: author,
              email: authorInfo.email,
              total_commits: 0,
              significant_commits: 0,
              simple_commits: 0,
              commit_score: 0,
              commits: []
            };
          }

          const contrib = periodContributors[author];
          contrib.total_commits++;
          if (commit.significant) {
            contrib.significant_commits++;
          } else {
            contrib.simple_commits++;
          }
          contrib.commit_score += commit.scores.total;

          // Find full commit data
          const fullCommit = contributorCommits[author].commits.find(c => c.hash === commit.hash);
          if (fullCommit) {
            contrib.commits.push(fullCommit);
          }
        }

        // Calculate final stats and assign tiers
        const contributors = Object.values(periodContributors)
          .map(c => ({
            ...c,
            avg_score: c.total_commits > 0 ? c.commit_score / c.total_commits : 0,
            significance_ratio: c.total_commits > 0 ? c.significant_commits / c.total_commits : 0,
            additional_contribution_score: 0
          }))
          .sort((a, b) => b.commit_score - a.commit_score);

        // Assign tiers
        contributors.forEach((c, index) => {
          const rank = index + 1;
          if (rank <= 5) {
            c.tier = 'T0';
            c.tier_name = 'Elite';
          } else if (rank <= 12) {
            c.tier = 'T1';
            c.tier_name = 'Advanced';
          } else if (rank <= 22) {
            c.tier = 'T2';
            c.tier_name = 'Intermediate';
          } else {
            c.tier = 'T3';
            c.tier_name = 'Contributing';
          }
        });

        leaderboards[periodType][periodKey] = contributors;
      }
    }

    return {
      last_updated: new Date().toISOString(),
      total_commits_analyzed: commits.length,
      analysis_period_days: daysBack,
      leaderboards,
      metadata: {
        analyzedAt: new Date().toISOString(),
        daysBack,
        totalCommits: commits.length,
        totalContributors: Object.keys(contributorCommits).length
      }
    };
  }

  mergeData(existingData, newData) {
    console.log('🔀 Merging datasets...');

    // Extract manual contributions from existing data to preserve them
    const manualContributions = {};
    if (existingData.leaderboards) {
      for (const [periodType, periods] of Object.entries(existingData.leaderboards)) {
        for (const [periodKey, contributors] of Object.entries(periods)) {
          for (const contributor of contributors) {
            const name = contributor.name;
            const additionalScore = contributor.additional_contribution_score || 0;
            const additionalContribs = contributor.additional_contributions || [];
            const additionalNotes = contributor.additional_contribution_notes || '';

            // Only save if there are manual contributions
            if (additionalScore > 0 && additionalContribs.length > 0) {
              if (!manualContributions[name]) {
                manualContributions[name] = {};
              }
              if (!manualContributions[name][periodType]) {
                manualContributions[name][periodType] = {};
              }
              manualContributions[name][periodType][periodKey] = {
                score: additionalScore,
                contributions: additionalContribs,
                notes: additionalNotes
              };
            }
          }
        }
      }
    }
    console.log(`📥 Preserved manual contributions for ${Object.keys(manualContributions).length} contributors`);

    // Collect all commits from both datasets, deduplicate by hash
    const allCommitsMap = new Map();

    // First, collect all commits from existing leaderboards
    if (existingData.leaderboards) {
      for (const [periodType, periods] of Object.entries(existingData.leaderboards)) {
        for (const [periodKey, contributors] of Object.entries(periods)) {
          for (const contributor of contributors) {
            if (contributor.commits) {
              for (const commit of contributor.commits) {
                allCommitsMap.set(commit.hash, commit);
              }
            }
          }
        }
      }
    }

    // Add new commits (will overwrite duplicates)
    if (newData.leaderboards) {
      for (const [periodType, periods] of Object.entries(newData.leaderboards)) {
        for (const [periodKey, contributors] of Object.entries(periods)) {
          for (const contributor of contributors) {
            if (contributor.commits) {
              for (const commit of contributor.commits) {
                allCommitsMap.set(commit.hash, commit);
              }
            }
          }
        }
      }
    }

    console.log(`📊 Total unique commits after merge: ${allCommitsMap.size}`);

    // Rebuild leaderboards from all unique commits
    const allCommits = Array.from(allCommitsMap.values());

    // Group commits by time period
    const timePeriods = { weekly: {}, monthly: {}, quarterly: {} };
    const contributorCommits = {};

    for (const commit of allCommits) {
      const date = new Date(commit.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const quarter = Math.ceil((date.getMonth() + 1) / 3);

      // Calculate ISO week number
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      const weekKey = `${year}-W${String(weekNo).padStart(2, '0')}`;
      const monthKey = `${year}-${month}`;
      const quarterKey = `${year}-Q${quarter}`;

      if (!timePeriods.weekly[weekKey]) timePeriods.weekly[weekKey] = [];
      if (!timePeriods.monthly[monthKey]) timePeriods.monthly[monthKey] = [];
      if (!timePeriods.quarterly[quarterKey]) timePeriods.quarterly[quarterKey] = [];

      timePeriods.weekly[weekKey].push(commit);
      timePeriods.monthly[monthKey].push(commit);
      timePeriods.quarterly[quarterKey].push(commit);

      // Track contributor commits
      const author = commit.author;
      if (!contributorCommits[author]) {
        contributorCommits[author] = {
          name: author,
          email: commit.email,
          commits: []
        };
      }
      contributorCommits[author].commits.push(commit);
    }

    // Generate leaderboards for each time period
    const leaderboards = {};
    for (const [periodType, periods] of Object.entries(timePeriods)) {
      leaderboards[periodType] = {};

      for (const [periodKey, periodCommits] of Object.entries(periods)) {
        const periodContributors = {};

        // Aggregate stats for this period
        for (const commit of periodCommits) {
          const author = commit.author;
          if (!periodContributors[author]) {
            const authorInfo = contributorCommits[author];
            periodContributors[author] = {
              name: author,
              email: authorInfo.email,
              total_commits: 0,
              significant_commits: 0,
              simple_commits: 0,
              commit_score: 0,
              commits: []
            };
          }

          const contrib = periodContributors[author];
          contrib.total_commits++;
          if (commit.classification === 'significant') {
            contrib.significant_commits++;
          } else {
            contrib.simple_commits++;
          }
          contrib.commit_score += commit.scores.total;
          contrib.commits.push(commit);
        }

        // Calculate final stats and apply manual contributions
        const contributors = Object.values(periodContributors)
          .map(c => {
            // Check if this contributor has manual contributions for this period
            const manualData = manualContributions[c.name]?.[periodType]?.[periodKey] || null;
            const additionalScore = manualData?.score || 0;
            const additionalContribs = manualData?.contributions || [];
            const additionalNotes = manualData?.notes || '';

            return {
              ...c,
              avg_score: c.total_commits > 0 ? c.commit_score / c.total_commits : 0,
              significance_ratio: c.total_commits > 0 ? c.significant_commits / c.total_commits : 0,
              additional_contribution_score: additionalScore,
              additional_contributions: additionalContribs,
              additional_contribution_notes: additionalNotes,
              total_score: c.commit_score + additionalScore
            };
          })
          .sort((a, b) => b.total_score - a.total_score);

        // Assign tiers based on ranking (not score)
        contributors.forEach((c, index) => {
          const rank = index + 1;
          if (rank <= 5) {
            c.tier = 'T0';
            c.tier_name = 'Elite';
          } else if (rank <= 12) {
            c.tier = 'T1';
            c.tier_name = 'Advanced';
          } else if (rank <= 22) {
            c.tier = 'T2';
            c.tier_name = 'Intermediate';
          } else {
            c.tier = 'T3';
            c.tier_name = 'Contributing';
          }
        });

        leaderboards[periodType][periodKey] = contributors;
      }
    }

    return {
      last_updated: new Date().toISOString(),
      total_commits_analyzed: allCommitsMap.size,
      analysis_period_days: existingData.analysis_period_days || 180,
      leaderboards,
      metadata: {
        analyzedAt: new Date().toISOString(),
        daysBack: existingData.analysis_period_days || 180,
        totalCommits: allCommitsMap.size,
        totalContributors: Object.keys(contributorCommits).length,
        mergedFrom: {
          existing: existingData.total_commits_analyzed,
          new: newData.total_commits_analyzed
        }
      }
    };
  }
}
