#!/usr/bin/env python3
"""
LMCache Contributor Leaderboard Analyzer
Extracts, classifies, and ranks commits from the LMCache repository.
"""

import json
import os
import re
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple
import anthropic


class CommitAnalyzer:
    def __init__(self, repo_path: str, anthropic_api_key: str = None, manual_contributions_path: str = "manual-contributions.json"):
        self.repo_path = Path(repo_path)
        self.anthropic_api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.client = anthropic.Anthropic(api_key=self.anthropic_api_key) if self.anthropic_api_key else None
        self.manual_contributions_path = Path(manual_contributions_path)

        # Scoring weights
        self.SIGNIFICANT_THRESHOLD = 50

        # Load manual contributions
        self.manual_contributions = self.load_manual_contributions()

    def load_manual_contributions(self) -> Dict:
        """Load manually assigned contribution scores."""
        if not self.manual_contributions_path.exists():
            return {}

        try:
            with open(self.manual_contributions_path, 'r') as f:
                data = json.load(f)
                contributors = data.get("contributors", {})

                # Normalize to new format (backward compatibility)
                normalized = {}
                for name, contrib_data in contributors.items():
                    if isinstance(contrib_data, dict):
                        # Check if it's the new format (has 'contributions' array)
                        if "contributions" in contrib_data:
                            normalized[name] = contrib_data
                        # Old format (has 'score' and 'notes' directly)
                        elif "score" in contrib_data:
                            normalized[name] = {
                                "contributions": [{
                                    "score": contrib_data.get("score", 0),
                                    "notes": contrib_data.get("notes", ""),
                                    "start_date": None,
                                    "end_date": None
                                }]
                            }

                return normalized
        except Exception as e:
            print(f"Warning: Could not load manual contributions: {e}")
            return {}

    def get_manual_score_for_period(self, author: str, period_start: datetime, period_end: datetime) -> Tuple[int, str]:
        """Get manual contribution score for a specific time period."""
        if author not in self.manual_contributions:
            return 0, ""

        contributor_data = self.manual_contributions[author]
        contributions = contributor_data.get("contributions", [])

        total_score = 0
        notes_list = []

        for contrib in contributions:
            contrib_start = datetime.fromisoformat(contrib["start_date"]) if contrib.get("start_date") else None
            contrib_end = datetime.fromisoformat(contrib["end_date"]) if contrib.get("end_date") else None

            # Check if contribution overlaps with the period
            # If no dates specified, applies to all periods
            if contrib_start is None and contrib_end is None:
                total_score += contrib.get("score", 0)
                if contrib.get("notes"):
                    notes_list.append(contrib["notes"])
            elif contrib_start is None and contrib_end >= period_start:
                total_score += contrib.get("score", 0)
                if contrib.get("notes"):
                    notes_list.append(contrib["notes"])
            elif contrib_end is None and contrib_start <= period_end:
                total_score += contrib.get("score", 0)
                if contrib.get("notes"):
                    notes_list.append(contrib["notes"])
            elif contrib_start and contrib_end and contrib_start <= period_end and contrib_end >= period_start:
                total_score += contrib.get("score", 0)
                if contrib.get("notes"):
                    notes_list.append(contrib["notes"])

        return total_score, "; ".join(notes_list)

    def run_git_command(self, cmd: List[str]) -> str:
        """Execute git command and return output."""
        result = subprocess.run(
            cmd,
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()

    def get_commits_since(self, days: int = 180) -> List[Dict]:
        """Get all commits from the last N days."""
        since_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        # Get commit hashes
        commits_output = self.run_git_command([
            "git", "log",
            f"--since={since_date}",
            "--format=%H|%an|%ae|%at|%s",
            "--no-merges"
        ])

        commits = []
        for line in commits_output.split("\n"):
            if not line.strip():
                continue

            parts = line.split("|", 4)
            if len(parts) < 5:
                continue

            commit_hash, author_name, author_email, timestamp, message = parts

            commits.append({
                "hash": commit_hash,
                "author_name": author_name,
                "author_email": author_email,
                "timestamp": int(timestamp),
                "date": datetime.fromtimestamp(int(timestamp)),
                "message": message
            })

        return commits

    def get_commit_stats(self, commit_hash: str) -> Dict:
        """Get detailed stats for a single commit."""
        try:
            # Get file changes
            files_output = self.run_git_command([
                "git", "show", "--pretty=", "--name-only", commit_hash
            ])
            files_changed = [f for f in files_output.split("\n") if f.strip()]

            # Get line changes
            stats_output = self.run_git_command([
                "git", "show", "--shortstat", commit_hash
            ])

            # Parse stats (format: "X files changed, Y insertions(+), Z deletions(-)")
            insertions = 0
            deletions = 0
            stats_match = re.search(r"(\d+) insertion", stats_output)
            if stats_match:
                insertions = int(stats_match.group(1))
            stats_match = re.search(r"(\d+) deletion", stats_output)
            if stats_match:
                deletions = int(stats_match.group(1))

            # Get diff for AI analysis
            diff_output = self.run_git_command([
                "git", "show", commit_hash
            ])
            # Limit diff size for AI (max 4000 chars)
            diff_truncated = diff_output[:4000] + ("..." if len(diff_output) > 4000 else "")

            return {
                "files_changed": len(files_changed),
                "files_list": files_changed,
                "insertions": insertions,
                "deletions": deletions,
                "total_lines": insertions + deletions,
                "diff": diff_truncated
            }
        except Exception as e:
            print(f"Error getting stats for {commit_hash}: {e}")
            return {
                "files_changed": 0,
                "files_list": [],
                "insertions": 0,
                "deletions": 0,
                "total_lines": 0,
                "diff": ""
            }

    def calculate_loc_score(self, total_lines: int) -> int:
        """Score based on lines of code changed."""
        if total_lines >= 100:
            return 30
        elif total_lines >= 50:
            return 15
        elif total_lines >= 20:
            return 8
        else:
            return 3

    def calculate_files_score(self, files_changed: int) -> int:
        """Score based on number of files modified."""
        if files_changed >= 5:
            return 20
        elif files_changed >= 2:
            return 10
        else:
            return 5

    def calculate_keyword_score(self, message: str) -> int:
        """Score based on conventional commit keywords."""
        message_lower = message.lower()

        # High impact keywords
        if any(kw in message_lower for kw in ["feat:", "feature:", "refactor:", "perf:", "breaking:"]):
            return 25
        # Medium impact
        elif any(kw in message_lower for kw in ["fix:", "bug:", "improve:", "enhance:", "update:"]):
            return 15
        # Low impact
        elif any(kw in message_lower for kw in ["docs:", "doc:", "typo:", "style:", "format:"]):
            return 5
        # Test/chore
        elif any(kw in message_lower for kw in ["test:", "chore:", "ci:"]):
            return 10
        else:
            return 12  # Default for commits without conventional format

    def calculate_ai_score(self, commit_data: Dict) -> int:
        """Use AI to evaluate commit significance (0-25 points)."""
        if not self.client:
            # Fallback: simple heuristic
            return min(25, commit_data["total_lines"] // 10)

        try:
            prompt = f"""Analyze this git commit and rate its significance from 0-25 points.

Commit message: {commit_data['message']}
Files changed: {commit_data['files_changed']}
Lines changed: {commit_data['total_lines']} ({commit_data['insertions']}+, {commit_data['deletions']}-)

Consider:
- Impact on architecture/design (high=20-25, medium=10-19, low=0-9)
- Bug severity if it's a fix
- Feature complexity
- Code quality improvements

Diff preview:
{commit_data['diff'][:1000]}

Respond with ONLY a number from 0-25."""

            message = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=10,
                messages=[{"role": "user", "content": prompt}]
            )

            score_text = message.content[0].text.strip()
            score = int(re.search(r"\d+", score_text).group())
            return min(25, max(0, score))

        except Exception as e:
            print(f"AI scoring failed: {e}, using fallback")
            return min(25, commit_data["total_lines"] // 10)

    def classify_commit(self, commit: Dict) -> Dict:
        """Classify a commit and calculate its score."""
        stats = self.get_commit_stats(commit["hash"])
        commit_data = {**commit, **stats}

        # Calculate scores
        loc_score = self.calculate_loc_score(stats["total_lines"])
        files_score = self.calculate_files_score(stats["files_changed"])
        keyword_score = self.calculate_keyword_score(commit["message"])
        ai_score = self.calculate_ai_score(commit_data)

        total_score = loc_score + files_score + keyword_score + ai_score

        return {
            "hash": commit["hash"][:8],
            "author": commit["author_name"],
            "email": commit["author_email"],
            "date": commit["date"].isoformat(),
            "message": commit["message"],
            "stats": {
                "files": stats["files_changed"],
                "lines": stats["total_lines"],
                "insertions": stats["insertions"],
                "deletions": stats["deletions"]
            },
            "scores": {
                "loc": loc_score,
                "files": files_score,
                "keyword": keyword_score,
                "ai": ai_score,
                "total": total_score
            },
            "classification": "significant" if total_score >= self.SIGNIFICANT_THRESHOLD else "simple"
        }

    def get_time_period(self, date: datetime, period: str) -> str:
        """Get time period identifier for a date."""
        if period == "weekly":
            # ISO week number
            return f"{date.year}-W{date.isocalendar()[1]:02d}"
        elif period == "monthly":
            return f"{date.year}-{date.month:02d}"
        elif period == "quarterly":
            quarter = (date.month - 1) // 3 + 1
            return f"{date.year}-Q{quarter}"
        return ""

    def parse_period_bounds(self, period_str: str, period_type: str) -> Tuple[datetime, datetime]:
        """Parse period string to get start and end dates."""
        if period_type == "weekly":
            # Format: YYYY-WNN
            year, week = period_str.split("-W")
            # Get the first day of the week (Monday)
            jan_4 = datetime(int(year), 1, 4)
            week_one_start = jan_4 - timedelta(days=jan_4.weekday())
            period_start = week_one_start + timedelta(weeks=int(week) - 1)
            period_end = period_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        elif period_type == "monthly":
            # Format: YYYY-MM
            year, month = period_str.split("-")
            period_start = datetime(int(year), int(month), 1)
            # Last day of month
            if int(month) == 12:
                period_end = datetime(int(year), 12, 31, 23, 59, 59)
            else:
                next_month = datetime(int(year), int(month) + 1, 1)
                period_end = next_month - timedelta(seconds=1)
        elif period_type == "quarterly":
            # Format: YYYY-QN
            year, quarter = period_str.split("-Q")
            start_month = (int(quarter) - 1) * 3 + 1
            period_start = datetime(int(year), start_month, 1)
            end_month = start_month + 2
            if end_month == 12:
                period_end = datetime(int(year), 12, 31, 23, 59, 59)
            else:
                next_quarter = datetime(int(year), end_month + 1, 1)
                period_end = next_quarter - timedelta(seconds=1)
        else:
            period_start = datetime.min
            period_end = datetime.max

        return period_start, period_end

    def aggregate_by_period(self, classified_commits: List[Dict]) -> Dict:
        """Aggregate commits by time period and author."""
        periods = {
            "weekly": defaultdict(lambda: defaultdict(list)),
            "monthly": defaultdict(lambda: defaultdict(list)),
            "quarterly": defaultdict(lambda: defaultdict(list))
        }

        for commit in classified_commits:
            date = datetime.fromisoformat(commit["date"])
            author = commit["author"]

            for period_type in ["weekly", "monthly", "quarterly"]:
                period = self.get_time_period(date, period_type)
                periods[period_type][period][author].append(commit)

        return periods

    def generate_leaderboard(self, aggregated_data: Dict) -> Dict:
        """Generate ranked leaderboards for each time period."""
        leaderboards = {}

        for period_type, periods in aggregated_data.items():
            period_leaderboards = {}

            for period, authors in periods.items():
                # Get period boundaries for filtering manual contributions
                period_start, period_end = self.parse_period_bounds(period, period_type)

                contributors = []

                for author, commits in authors.items():
                    total_commits = len(commits)
                    significant = sum(1 for c in commits if c["classification"] == "significant")
                    simple = total_commits - significant
                    commit_score = sum(c["scores"]["total"] for c in commits)
                    avg_score = commit_score / total_commits if total_commits > 0 else 0

                    # Get email (use first commit's email)
                    email = commits[0]["email"] if commits else ""

                    # Get manual contribution score FOR THIS PERIOD
                    manual_score, manual_notes = self.get_manual_score_for_period(author, period_start, period_end)

                    # Calculate total score (commits + other contributions)
                    total_score = commit_score + manual_score

                    contributors.append({
                        "name": author,
                        "email": email,
                        "total_commits": total_commits,
                        "significant_commits": significant,
                        "simple_commits": simple,
                        "significance_ratio": significant / total_commits if total_commits > 0 else 0,
                        "commit_score": commit_score,  # Score from commits only
                        "avg_score": round(avg_score, 2),
                        "additional_contribution_score": manual_score,
                        "additional_contribution_notes": manual_notes,
                        "total_score": total_score,  # Total score (commits + other contrib)
                        "commits": commits
                    })

                # Sort by TOTAL score (commits + other contrib), then by total commits
                contributors.sort(key=lambda x: (x["total_score"], x["total_commits"]), reverse=True)

                # Assign tiers instead of ranks
                # T0: Top 5 (Elite)
                # T1: Next 7 (positions 6-12) (Advanced)
                # T2: Next 10 (positions 13-22) (Intermediate)
                # T3+: Everyone else (Contributing)
                for i, contributor in enumerate(contributors, 1):
                    contributor["rank"] = i  # Keep numeric rank for internal sorting
                    if i <= 5:
                        contributor["tier"] = "T0"
                        contributor["tier_name"] = "Elite"
                    elif i <= 12:
                        contributor["tier"] = "T1"
                        contributor["tier_name"] = "Advanced"
                    elif i <= 22:
                        contributor["tier"] = "T2"
                        contributor["tier_name"] = "Intermediate"
                    else:
                        contributor["tier"] = "T3"
                        contributor["tier_name"] = "Contributing"

                period_leaderboards[period] = contributors

            leaderboards[period_type] = period_leaderboards

        return leaderboards

    def analyze(self, output_file: str = "leaderboard-data.json"):
        """Main analysis pipeline."""
        print("🔍 Fetching commits from last 6 months...")
        commits = self.get_commits_since(days=180)
        print(f"   Found {len(commits)} commits")

        print("\n📊 Classifying commits...")
        classified_commits = []
        for i, commit in enumerate(commits, 1):
            if i % 10 == 0:
                print(f"   Progress: {i}/{len(commits)}")
            classified_commits.append(self.classify_commit(commit))

        print("\n📅 Aggregating by time period...")
        aggregated = self.aggregate_by_period(classified_commits)

        print("\n🏆 Generating leaderboards...")
        leaderboards = self.generate_leaderboard(aggregated)

        # Prepare output
        output = {
            "last_updated": datetime.now().isoformat(),
            "total_commits_analyzed": len(classified_commits),
            "analysis_period_days": 180,
            "leaderboards": leaderboards,
            "metadata": {
                "scoring_system": {
                    "loc_score": "0-30 points based on lines changed",
                    "files_score": "0-20 points based on files modified",
                    "keyword_score": "0-25 points based on commit type",
                    "ai_score": "0-25 points based on AI impact analysis",
                    "total": "0-100 points",
                    "significant_threshold": self.SIGNIFICANT_THRESHOLD
                }
            }
        }

        # Save to file
        output_path = Path(output_file)
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)

        print(f"\n✅ Analysis complete! Results saved to {output_path}")
        print(f"   Total commits: {len(classified_commits)}")
        print(f"   Significant: {sum(1 for c in classified_commits if c['classification'] == 'significant')}")
        print(f"   Simple: {sum(1 for c in classified_commits if c['classification'] == 'simple')}")

        return output


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Analyze LMCache commits for leaderboard")
    parser.add_argument("--repo", default="../LMCache", help="Path to LMCache repository")
    parser.add_argument("--output", default="leaderboard-data.json", help="Output JSON file")
    parser.add_argument("--api-key", help="Anthropic API key (or set ANTHROPIC_API_KEY env var)")

    args = parser.parse_args()

    analyzer = CommitAnalyzer(args.repo, args.api_key)
    analyzer.analyze(args.output)
