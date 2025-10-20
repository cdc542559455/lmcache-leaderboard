// Test pull-and-refresh with existing data (incremental 1-day update)
import { Octokit } from '@octokit/rest';
import { CommitAnalyzer } from '/Users/lokichen/Desktop/lmcache-leaderboard/api/_lib/analyzeCommitsGithub.js';
import fs from 'fs';

async function test() {
  console.log('🧪 Testing Pull-and-Refresh with Incremental Update (1 day)\n');

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  // Simulate existing data
  console.log('📥 Loading existing leaderboard data...');
  const existingData = JSON.parse(
    fs.readFileSync('/Users/lokichen/Desktop/lmcache-leaderboard/dashboard/public/leaderboard-data.json', 'utf-8')
  );
  console.log(`✅ Found existing data with ${existingData.total_commits_analyzed} commits\n`);

  // This is what happens when existing data is found
  const daysToAnalyze = 1;
  console.log(`🔄 Analyzing last ${daysToAnalyze} day(s) of commits...`);
  
  const startTime = Date.now();
  
  const analyzer = new CommitAnalyzer(GITHUB_TOKEN, OPENAI_API_KEY);
  const newData = await analyzer.analyze('LMCache', 'LMCache', daysToAnalyze);
  
  console.log(`✅ New data analyzed: ${newData.total_commits_analyzed} commits\n`);

  // Merge with existing data
  console.log('🔀 Merging new commits with existing data...');
  const mergedData = analyzer.mergeData(existingData, newData);
  console.log(`✅ Merged data: ${mergedData.total_commits_analyzed} total commits\n`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`⏱️  Total time: ${duration} seconds`);
  
  if (parseFloat(duration) < 10) {
    console.log(`\n✅ SUCCESS! Completed in ${duration}s (under 10s Vercel timeout)`);
  } else {
    console.log(`\n⚠️  WARNING: Took ${duration}s (exceeds 10s Vercel Hobby timeout)`);
  }
}

test().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
