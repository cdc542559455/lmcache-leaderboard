import { useState } from 'react'

function Leaderboard({ contributors }) {
  const [expandedRow, setExpandedRow] = useState(null)

  const getTierBadgeClass = (tier) => {
    switch(tier) {
      case 'T0': return 'tier-0'
      case 'T1': return 'tier-1'
      case 'T2': return 'tier-2'
      case 'T3': return 'tier-3'
      default: return 'tier-other'
    }
  }

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index)
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-8 h-8 text-lm-orange" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
        </svg>
        <h2 className="text-2xl font-bold text-lm-orange">
          Contributor Rankings
        </h2>
      </div>

      {/* Tier Legend */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">Tier System:</span>
          <div className="flex items-center gap-2">
            <div className="tier-badge tier-0">T0</div>
            <span className="text-xs text-gray-600">Elite (Top 5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="tier-badge tier-1">T1</div>
            <span className="text-xs text-gray-600">Advanced (6-12)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="tier-badge tier-2">T2</div>
            <span className="text-xs text-gray-600">Intermediate (13-22)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="tier-badge tier-3">T3</div>
            <span className="text-xs text-gray-600">Contributing (23+)</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">Tier</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Contributor</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700">Commits</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700">Sig</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700">Sim</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700">Impact</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700">Commit</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700">Other</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-lm-orange">Total</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700">Avg</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700"></th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((contributor, index) => (
              <>
                <tr
                  key={contributor.name}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => toggleRow(index)}
                >
                  {/* Tier Badge */}
                  <td className="px-2 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <div className={`tier-badge ${getTierBadgeClass(contributor.tier)}`}>
                        {contributor.tier}
                      </div>
                      <span className="text-xs text-gray-500">{contributor.tier_name}</span>
                    </div>
                  </td>

                  {/* Contributor Name */}
                  <td className="px-2 py-3">
                    <div>
                      <div className="font-semibold text-gray-900">{contributor.name}</div>
                      <div className="text-xs text-gray-600">{contributor.email}</div>
                    </div>
                  </td>

                  {/* Total Commits */}
                  <td className="px-2 py-3 text-center">
                    <span className="inline-flex items-center justify-center bg-lm-orange/10 text-lm-orange font-bold rounded-full w-12 h-12 text-base border border-lm-orange/20">
                      {contributor.total_commits}
                    </span>
                  </td>

                  {/* Significant Commits */}
                  <td className="px-2 py-3 text-center">
                    <span className="text-green-600 font-semibold text-base">
                      {contributor.significant_commits}
                    </span>
                  </td>

                  {/* Simple Commits */}
                  <td className="px-2 py-3 text-center">
                    <span className="text-blue-600 font-semibold text-base">
                      {contributor.simple_commits}
                    </span>
                  </td>

                  {/* Significance Ratio */}
                  <td className="px-2 py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-lm-orange font-bold text-base mb-1">
                        {(contributor.significance_ratio * 100).toFixed(0)}%
                      </span>
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="score-bar h-full"
                          style={{ width: `${contributor.significance_ratio * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>

                  {/* Commit Score */}
                  <td className="px-2 py-3 text-center">
                    <span className="text-blue-600 font-bold text-base">
                      {contributor.commit_score}
                    </span>
                  </td>

                  {/* Other Contribution Score */}
                  <td className="px-2 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-bold text-base ${contributor.additional_contribution_score > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {contributor.additional_contribution_score > 0 ? `+${contributor.additional_contribution_score}` : '-'}
                      </span>
                      {contributor.additional_contribution_notes && (
                        <div className="group relative">
                          <button className="text-xs text-gray-500 hover:text-lm-orange">
                            ℹ️
                          </button>
                          <div className="hidden group-hover:block absolute z-10 w-48 p-2 mt-1 text-xs bg-gray-900 text-white rounded shadow-lg">
                            {contributor.additional_contribution_notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Total Score (Commit + Other Contrib) */}
                  <td className="px-2 py-3 text-center">
                    <span className="text-lm-orange font-bold text-lg">
                      {contributor.total_score}
                    </span>
                  </td>

                  {/* Average Score */}
                  <td className="px-2 py-3 text-center">
                    <span className="text-gray-700 font-semibold">
                      {contributor.avg_score}
                    </span>
                  </td>

                  {/* Expand Icon */}
                  <td className="px-2 py-3 text-center">
                    <button className="text-gray-500 hover:text-lm-orange transition-colors">
                      {expandedRow === index ? '▼' : '▶'}
                    </button>
                  </td>
                </tr>

                {/* Expanded Details */}
                {expandedRow === index && (
                  <tr className="bg-gray-50">
                    <td colSpan="9" className="px-4 py-6">
                      <div className="ml-16">
                        <h4 className="text-base font-semibold text-lm-orange mb-4">
                          Recent Commits ({contributor.commits.length})
                        </h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-4">
                          {contributor.commits.slice(0, 20).map((commit, idx) => (
                            <div
                              key={commit.hash}
                              className="bg-white rounded-lg p-4 border-l-4 shadow-sm"
                              style={{
                                borderLeftColor: commit.classification === 'significant' ? '#16a34a' : '#2563eb'
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="font-mono text-xs text-gray-600">{commit.hash}</span>
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                      commit.classification === 'significant'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {commit.classification}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      {new Date(commit.date).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-gray-900 mb-2 font-medium">{commit.message}</p>
                                  <div className="flex gap-4 text-sm text-gray-600">
                                    <span>📁 {commit.stats.files} files</span>
                                    <span>📊 {commit.stats.lines} lines</span>
                                    <span className="text-green-600">+{commit.stats.insertions}</span>
                                    <span className="text-red-600">-{commit.stats.deletions}</span>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-2xl font-bold text-lm-orange">
                                    {commit.scores.total}
                                  </div>
                                  <div className="text-xs text-gray-600">score</div>
                                  <div className="mt-2 text-xs space-y-1 text-gray-600">
                                    <div>LOC: {commit.scores.loc}</div>
                                    <div>Files: {commit.scores.files}</div>
                                    <div>Type: {commit.scores.keyword}</div>
                                    <div>AI: {commit.scores.ai}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {contributor.commits.length > 20 && (
                            <p className="text-center text-gray-500 text-sm pt-2">
                              Showing 20 of {contributor.commits.length} commits
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {contributors.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No contributors found for this period.
          </div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard
