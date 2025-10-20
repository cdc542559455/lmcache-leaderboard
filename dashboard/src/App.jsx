import { useState, useEffect } from 'react'
import Leaderboard from './components/Leaderboard'
import StatsOverview from './components/StatsOverview'
import ContributionChart from './components/ContributionChart'
import AdminPanel from './components/AdminPanel'
import FilterPanel from './components/FilterPanel'
import { formatDistanceToNow } from 'date-fns'

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timePeriod, setTimePeriod] = useState('monthly')
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [filteredContributors, setFilteredContributors] = useState(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('lmcache_filtered_contributors')
    return saved ? JSON.parse(saved) : []
  })

  // Save to localStorage whenever filtered list changes
  useEffect(() => {
    localStorage.setItem('lmcache_filtered_contributors', JSON.stringify(filteredContributors))
  }, [filteredContributors])

  useEffect(() => {
    // Load the last update info
    fetch('./last-update.json')
      .then(res => res.json())
      .then(updateInfo => {
        setLastUpdate(updateInfo)
      })
      .catch(() => {
        // If file doesn't exist yet, that's OK
        setLastUpdate(null)
      })

    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetch('./last-update.json')
        .then(res => res.json())
        .then(updateInfo => {
          setLastUpdate(updateInfo)
        })
        .catch(() => {})
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Load the leaderboard data
    fetch('./leaderboard-data.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load data')
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)

        // Select the most recent period by default
        if (data.leaderboards && data.leaderboards[timePeriod]) {
          const periods = Object.keys(data.leaderboards[timePeriod]).sort().reverse()
          if (periods.length > 0) {
            setSelectedPeriod(periods[0])
          }
        }
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    // Update selected period when time period changes
    if (data && data.leaderboards && data.leaderboards[timePeriod]) {
      const periods = Object.keys(data.leaderboards[timePeriod]).sort().reverse()
      if (periods.length > 0) {
        setSelectedPeriod(periods[0])
      }
    }
  }, [timePeriod, data])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-lm-orange"></div>
          <p className="mt-4 text-xl text-gray-400">Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-400 mb-2">Error Loading Data</h2>
          <p className="text-gray-400">{error}</p>
          <p className="text-sm text-gray-500 mt-4">
            Make sure leaderboard-data.json exists in the public directory.
          </p>
        </div>
      </div>
    )
  }

  const availablePeriods = Object.keys(data.leaderboards[timePeriod] || {}).sort().reverse()

  // Ensure selectedPeriod is valid for current timePeriod
  const validSelectedPeriod = availablePeriods.includes(selectedPeriod)
    ? selectedPeriod
    : availablePeriods[0]

  const allLeaderboardData = (data.leaderboards[timePeriod] && data.leaderboards[timePeriod][validSelectedPeriod]) || []

  // Filter out hidden contributors
  const visibleContributors = allLeaderboardData.filter(contributor =>
    !filteredContributors.includes(contributor.name)
  )

  // Recalculate tiers based on visible contributors (T0: top 5, T1: 6-12, T2: 13-22, T3: 23+)
  const currentLeaderboard = visibleContributors.map((contributor, index) => {
    const rank = index + 1
    let tier, tierName

    if (rank <= 5) {
      tier = 'T0'
      tierName = 'Elite'
    } else if (rank <= 12) {
      tier = 'T1'
      tierName = 'Advanced'
    } else if (rank <= 22) {
      tier = 'T2'
      tierName = 'Intermediate'
    } else {
      tier = 'T3'
      tierName = 'Contributing'
    }

    return {
      ...contributor,
      tier,
      tier_name: tierName
    }
  })

  // Calculate total stats (from visible contributors only)
  const totalSignificant = currentLeaderboard.reduce((sum, c) => sum + c.significant_commits, 0)
  const totalSimple = currentLeaderboard.reduce((sum, c) => sum + c.simple_commits, 0)
  const totalCommits = totalSignificant + totalSimple

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Panel Modal */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <svg className="w-12 h-12 text-lm-orange" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.48.41-2.86 1.12-4.06l10.94 10.94C14.86 19.59 13.48 20 12 20zm6.88-3.94L8.94 6.12C10.14 5.41 11.52 5 13 5c4.41 0 8 3.59 8 8 0 1.48-.41 2.86-1.12 4.06z"/>
                <path d="M7 13h2v-2H7v2zm0-4h2V7H7v2zm4 4h2v-2h-2v2zm0-4h2V7h-2v2zm4 4h2v-2h-2v2zm0-4h2V7h-2v2z"/>
              </svg>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-lm-orange to-lm-orange-light bg-clip-text text-transparent">
                  LMCache Leaderboard
                </h1>
                <p className="text-gray-600 mt-2">
                  Contributor rankings based on commit impact
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAdmin(true)}
                className="px-4 py-2 bg-gradient-to-r from-lm-orange to-lm-orange-light text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                title="Admin Panel - Manage manual contributions"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
                </svg>
                Admin
              </button>
              <div className="text-right">
                <p className="text-sm text-gray-600">Data generated</p>
                <p className="text-lm-orange font-semibold">
                  {formatDistanceToNow(new Date(data.last_updated), { addSuffix: true })}
                </p>
                {lastUpdate && lastUpdate.success && (
                  <div className="mt-1">
                    <p className="text-xs text-gray-500">
                      Auto-refresh: {formatDistanceToNow(new Date(lastUpdate.timestamp), { addSuffix: true })}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-xs text-green-600 font-medium">Live updates every 15min</span>
                    </div>
                  </div>
                )}
                {lastUpdate && !lastUpdate.success && (
                  <p className="text-xs text-red-500 mt-1">
                    Auto-refresh error
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <StatsOverview
          totalCommits={totalCommits}
          significantCommits={totalSignificant}
          simpleCommits={totalSimple}
          contributors={currentLeaderboard.length}
        />

        {/* Filter Contributors */}
        <FilterPanel
          contributors={allLeaderboardData.map(c => c.name)}
          filteredContributors={filteredContributors}
          setFilteredContributors={setFilteredContributors}
        />

        {/* Time Period Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {['weekly', 'monthly', 'quarterly'].map(period => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={`btn-tab ${timePeriod === period ? 'btn-tab-active' : 'btn-tab-inactive'}`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
          <div className="ml-4 px-4 py-2 bg-lm-orange/10 border border-lm-orange/30 rounded-lg text-sm">
            <span className="text-gray-600">Viewing: </span>
            <span className="font-bold text-lm-orange">{validSelectedPeriod}</span>
            <span className="text-gray-500 ml-2">({currentLeaderboard.length} contributors)</span>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mt-4 flex items-center gap-4">
          <label className="text-gray-700 font-semibold">Select Period:</label>
          <select
            key={timePeriod}
            value={validSelectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-lm-orange shadow-sm"
          >
            {availablePeriods.map(period => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </div>

        {/* Contribution Chart */}
        <div className="mt-8">
          <ContributionChart
            key={`chart-${timePeriod}-${validSelectedPeriod}`}
            data={data.leaderboards[timePeriod]}
            currentPeriod={validSelectedPeriod}
            timePeriodType={timePeriod}
          />
        </div>

        {/* Leaderboard Table */}
        <div className="mt-8">
          <Leaderboard
            key={`leaderboard-${timePeriod}-${validSelectedPeriod}`}
            contributors={currentLeaderboard}
          />
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm pb-8">
          <p>
            Analyzing {data.total_commits_analyzed} commits from the last {data.analysis_period_days} days
          </p>
          <p className="mt-2">
            Scoring: LOC (30pts) + Files (20pts) + Keywords (25pts) + AI Analysis (25pts) = Total (100pts)
          </p>
          <p className="mt-1">
            Significant commits: ≥50 points | Simple fixes: &lt;50 points
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
