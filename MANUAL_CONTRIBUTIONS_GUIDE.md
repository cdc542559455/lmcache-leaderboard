# 📝 Manual Contributions Guide

This guide explains how to track non-GitHub contributions like papers, community work, and advocacy.

## 🎯 What Counts as "Other Contributions"?

Track contributions that don't show up in GitHub commits:

| Type | Suggested Score | Examples |
|------|----------------|----------|
| **Paper Publication** | 20-50 pts | Research papers, white papers |
| **Conference Talk** | 15-30 pts | Presenting at conferences, meetups |
| **Blog Post/Tutorial** | 10-20 pts | Technical articles, documentation |
| **Community Advocacy** | 5-15 pts | Social media promotion, community engagement |
| **Mentorship** | 10-25 pts | Helping new contributors, code reviews |
| **Issue Triage** | 5-10 pts | Organizing issues, project management |

## ✏️ How to Add Manual Scores

### Step 1: Edit `manual-contributions.json`

```bash
cd ~/Desktop/lmcache-leaderboard
nano manual-contributions.json
```

### Step 2: Add/Update Contributor Scores

```json
{
  "_instructions": "Manually assign additional contribution scores here...",
  "_scoring_guide": {
    "paper_publication": "20-50 points per paper",
    "conference_talk": "15-30 points",
    "blog_post": "10-20 points",
    "community_advocacy": "5-15 points",
    "mentorship": "10-25 points",
    "issue_triage": "5-10 points"
  },
  "contributors": {
    "Kobe Chen": {
      "score": 50,
      "notes": "Published LMCache paper (+30), Conference talk at MLSys (+20)"
    },
    "maobaolong": {
      "score": 25,
      "notes": "Community advocacy on Twitter/Reddit (+15), Blog post (+10)"
    },
    "chunxiaozheng": {
      "score": 15,
      "notes": "Mentoring new contributors (+15)"
    }
  }
}
```

### Step 3: Regenerate Leaderboard

```bash
cd ~/Desktop/lmcache-leaderboard
python3 analyze_commits.py --repo ./LMCache --output dashboard/public/leaderboard-data.json
```

The dashboard will automatically reload and show the updated scores!

## 📊 How It Appears in the Dashboard

| Column | Description |
|--------|-------------|
| **Commit Score** | Points from GitHub commits (automated) |
| **Other Contrib** | Manual points for non-code contributions |
| **ℹ️ Icon** | Hover to see breakdown notes |

### Example Display:

```
Kobe Chen
├─ Commit Score: 334
├─ Other Contrib: +50 ℹ️
│  └─ "Published LMCache paper (+30), Conference talk at MLSys (+20)"
└─ Total Impact: High
```

## 🔄 Best Practices

1. **Be Consistent**: Use similar scoring across all contributors
2. **Document Everything**: Always add notes explaining the score
3. **Update Regularly**: Review and update scores monthly/quarterly
4. **Be Fair**: Consider relative effort and impact
5. **Backup**: Keep the `manual-contributions.json` file in version control

## 🚀 Automation (Optional)

You can automate score updates by:

1. Creating a GitHub Action that updates `manual-contributions.json`
2. Using a Google Form to collect contribution reports
3. Integrating with project management tools

## ❓ FAQs

**Q: Will manual scores be overwritten when I regenerate data?**
A: No! The `manual-contributions.json` file is separate and won't be overwritten.

**Q: Can I give negative scores?**
A: Yes, but it's not recommended. Better to use lower positive scores.

**Q: How do I remove a contributor's manual score?**
A: Set their score to `0` and clear the notes field.

**Q: Can contributors have different score breakdowns?**
A: Yes! Just edit the notes field to explain their specific contributions.

## 📧 Questions?

If you have questions about the scoring system, open an issue or contact the maintainer.
