// GitHub API-based commit analysis (no git binary required)
import { Octokit } from '@octokit/rest';
import { OpenAI } from 'openai';

export class CommitAnalyzer {
  constructor(githubToken, openaiApiKey = null) {
    this.octokit = new Octokit({ auth: githubToken });
    this.openaiApiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    this.openaiClient = this.openaiApiKey ? new OpenAI({ apiKey: this.openaiApiKey }) : null;
  }

  async getCommitsSince(owner, repo, days = 180) {
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

  async analyze(owner, repo, daysBack = 180) {
    console.log(`Analyzing ${owner}/${repo} for last ${daysBack} days...`);
    const commits = await this.getCommitsSince(owner, repo, daysBack);

    const classifiedCommits = [];
    const contributorStats = {};

    let processed = 0;
    for (const commit of commits) {
      const classified = await this.classifyCommit(owner, repo, commit);
      classifiedCommits.push(classified);

      // Aggregate by contributor
      const author = classified.author;
      if (!contributorStats[author]) {
        contributorStats[author] = {
          name: author,
          email: classified.email,
          commits: 0,
          significantCommits: 0,
          totalScore: 0,
          totalLines: 0,
          recentCommits: []
        };
      }

      const stats = contributorStats[author];
      stats.commits++;
      if (classified.significant) stats.significantCommits++;
      stats.totalScore += classified.scores.total;
      stats.totalLines += classified.stats.lines;
      stats.recentCommits.push({
        hash: classified.hash,
        date: classified.date,
        message: classified.message,
        score: classified.scores.total
      });

      processed++;
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${commits.length} commits`);
      }
    }

    // Sort contributors by score
    const contributors = Object.values(contributorStats)
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((c, index) => ({
        rank: index + 1,
        ...c,
        recentCommits: c.recentCommits.slice(0, 10) // Keep only top 10
      }));

    return {
      metadata: {
        analyzedAt: new Date().toISOString(),
        daysBack,
        totalCommits: commits.length,
        totalContributors: contributors.length
      },
      contributors
    };
  }
}
