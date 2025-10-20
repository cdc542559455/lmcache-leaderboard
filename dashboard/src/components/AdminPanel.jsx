import { useState, useEffect } from 'react'
import { Octokit } from '@octokit/rest'
import { API_ENDPOINTS } from '../config'

// Authorized admin emails and usernames - hardcoded list
const AUTHORIZED_ADMINS = [
  'lokichen3@gmail.com', // Primary admin email
  'cdc542559455', // Primary admin GitHub username
]

function AdminPanel({ onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [manualContributions, setManualContributions] = useState({})
  const [leaderboardData, setLeaderboardData] = useState(null)
  const [allContributors, setAllContributors] = useState([])
  const [admins, setAdmins] = useState([])
  const [editingContributor, setEditingContributor] = useState(null)
  const [newContributor, setNewContributor] = useState({ name: '', score: 0, notes: '' })
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [user, setUser] = useState(null)
  const [showAdminManager, setShowAdminManager] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [addingContributionFor, setAddingContributionFor] = useState(null)
  const [newContribution, setNewContribution] = useState({ score: 0, notes: '', start_date: '', end_date: '' })
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [showAddNewContributor, setShowAddNewContributor] = useState(false)
  const [newContributorForm, setNewContributorForm] = useState({ name: '', email: '', score: 0, notes: '', start_date: '', end_date: '' })

  // Load token from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('github_admin_token')
    if (storedToken) {
      setGithubToken(storedToken)
      verifyToken(storedToken)
    }
  }, [])

  const verifyToken = async (token) => {
    try {
      const octokit = new Octokit({ auth: token })
      const { data } = await octokit.users.getAuthenticated()
      setUser(data)
      setIsAuthenticated(true)

      // Load admin list from repository
      const adminList = await loadAdminList(token)

      // Try to get user email - it might be null if private
      let userEmail = data.email

      // If email is null (private), try to fetch all emails
      if (!userEmail) {
        try {
          const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser()
          // Find the primary email
          const primaryEmail = emails.find(e => e.primary)
          userEmail = primaryEmail ? primaryEmail.email : emails[0]?.email
        } catch (error) {
          console.log('Could not fetch user emails:', error)
          // Email fetching failed, will use username fallback
        }
      }

      // Check if user is authorized by email or username
      const authorizedList = [...AUTHORIZED_ADMINS, ...adminList]
      const isAuthorizedByEmail = userEmail && authorizedList.includes(userEmail)
      const isAuthorizedByUsername = authorizedList.includes(data.login)

      console.log('Debug - User login:', data.login)
      console.log('Debug - User email:', userEmail)
      console.log('Debug - Authorized list:', authorizedList)
      console.log('Debug - isAuthorizedByEmail:', isAuthorizedByEmail)
      console.log('Debug - isAuthorizedByUsername:', isAuthorizedByUsername)

      if (isAuthorizedByEmail || isAuthorizedByUsername) {
        setIsAuthorized(true)
        await loadContributors(token)
      } else {
        setIsAuthorized(false)
        setMessage({
          type: 'error',
          text: `Access Denied: ${userEmail || data.login} is not authorized. Contact lokichen3@gmail.com for access.`
        })
      }
    } catch (error) {
      console.error('Token verification failed:', error)
      setMessage({ type: 'error', text: 'Invalid GitHub token' })
      localStorage.removeItem('github_admin_token')
      setIsAuthenticated(false)
      setIsAuthorized(false)
    }
  }

  const loadAdminList = async (token) => {
    try {
      const octokit = new Octokit({ auth: token })
      const owner = import.meta.env.VITE_GITHUB_REPO_OWNER || 'cdc542559455'
      const repo = import.meta.env.VITE_GITHUB_REPO_NAME || 'LMCache'

      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: 'admin-list.json'
        })
        const content = JSON.parse(atob(data.content))
        const adminList = content.admins || []
        setAdmins(adminList)
        return adminList  // Return the list for immediate use
      } catch (error) {
        // File doesn't exist yet, start with empty list
        setAdmins([])
        return []
      }
    } catch (error) {
      console.error('Failed to load admin list:', error)
      setAdmins([])
      return []
    }
  }

  const saveAdminList = async () => {
    try {
      setLoading(true)
      const octokit = new Octokit({ auth: githubToken })
      const owner = import.meta.env.VITE_GITHUB_REPO_OWNER || 'cdc542559455'
      const repo = import.meta.env.VITE_GITHUB_REPO_NAME || 'LMCache'
      const path = 'admin-list.json'
      const branchName = 'leaderboard-updates'

      // Get the default branch (usually 'main' or 'master')
      const { data: repoData } = await octokit.repos.get({ owner, repo })
      const defaultBranch = repoData.default_branch

      // Get the SHA of the default branch
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`
      })
      const defaultBranchSha = refData.object.sha

      // Try to create or update the leaderboard-updates branch
      try {
        // Try to get existing branch
        await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${branchName}`
        })
        // Branch exists, update it to point to latest default branch
        await octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${branchName}`,
          sha: defaultBranchSha,
          force: true
        })
      } catch (error) {
        // Branch doesn't exist, create it
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: defaultBranchSha
        })
      }

      // Get current file SHA from the branch
      let sha = null
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branchName
        })
        sha = data.sha
      } catch (e) {
        // File doesn't exist yet
      }

      const fileContent = {
        "_instructions": "List of authorized admin emails for the LMCache leaderboard admin panel",
        "admins": admins
      }

      const content = btoa(JSON.stringify(fileContent, null, 2))

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `🔐 Update admin list\n\nUpdated by ${user.login}`,
        content,
        sha,
        branch: branchName
      })

      setMessage({ type: 'success', text: `✅ Admin list updated on branch '${branchName}'!` })
      setNewAdminEmail('')
      setLoading(false)
    } catch (error) {
      console.error('Failed to save admin list:', error)
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` })
      setLoading(false)
    }
  }

  const handleAddAdmin = () => {
    const emailOrUsername = newAdminEmail.trim()
    if (!emailOrUsername) {
      setMessage({ type: 'error', text: 'Please enter an email address or GitHub username' })
      return
    }
    if ([...AUTHORIZED_ADMINS, ...admins].includes(emailOrUsername)) {
      setMessage({ type: 'error', text: 'This email/username is already an admin' })
      return
    }

    const updated = [...admins, emailOrUsername]
    setAdmins(updated)
    setTimeout(() => saveAdminList(), 100)
  }

  const handleRemoveAdmin = (email) => {
    if (!confirm(`Remove ${email} from admin list?`)) return

    const updated = admins.filter(a => a !== email)
    setAdmins(updated)
    setTimeout(() => saveAdminList(), 100)
  }

  const handleLogin = async () => {
    if (!tokenInput.trim()) {
      setMessage({ type: 'error', text: 'Please enter a GitHub token' })
      return
    }

    localStorage.setItem('github_admin_token', tokenInput)
    setGithubToken(tokenInput)
    await verifyToken(tokenInput)
    setTokenInput('')
  }

  const handleLogout = () => {
    localStorage.removeItem('github_admin_token')
    setGithubToken('')
    setIsAuthenticated(false)
    setIsAuthorized(false)
    setUser(null)
    setManualContributions({})
    setAllContributors([])
    setLeaderboardData(null)
    setAdmins([])
  }

  const loadContributors = async (token) => {
    try {
      setLoading(true)
      const octokit = new Octokit({ auth: token })

      let manualContribs = {}

      // Load manual contributions first
      try {
        const response = await fetch('/manual-contributions.json')
        const data = await response.json()
        manualContribs = data.contributors || {}

        // Normalize to new format (ensure each contributor has contributions array)
        const normalized = {}
        for (const [name, contrib] of Object.entries(manualContribs)) {
          if (contrib.contributions) {
            normalized[name] = contrib
          } else if (contrib.score !== undefined) {
            // Old format - convert to new
            normalized[name] = {
              contributions: [{
                score: contrib.score || 0,
                notes: contrib.notes || '',
                start_date: null,
                end_date: null
              }]
            }
          }
        }

        setManualContributions(normalized)
      } catch (e) {
        // If local file doesn't exist, try to fetch from GitHub
        const owner = import.meta.env.VITE_GITHUB_REPO_OWNER || 'cdc542559455'
        const repo = import.meta.env.VITE_GITHUB_REPO_NAME || 'LMCache'

        try {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'manual-contributions.json'
          })

          const content = JSON.parse(atob(data.content))
          manualContribs = content.contributors || {}
          setManualContributions(manualContribs)
        } catch (error) {
          console.log('File not found in repo, starting with empty contributors')
          setManualContributions({})
        }
      }

      // Load leaderboard data to get all contributors
      try {
        const leaderboardResponse = await fetch('/leaderboard-data.json')
        const leaderboardJson = await leaderboardResponse.json()
        setLeaderboardData(leaderboardJson)

        // Extract all unique contributor names from all periods
        const contributorNames = new Set()
        const periods = ['weekly', 'monthly', 'quarterly']

        periods.forEach(periodType => {
          const periodData = leaderboardJson.leaderboards[periodType] || {}
          Object.values(periodData).forEach(contributors => {
            contributors.forEach(contributor => {
              contributorNames.add(contributor.name)
            })
          })
        })

        // IMPORTANT: Also add contributors from manual-contributions.json
        // These might not be in the current leaderboard periods
        Object.keys(manualContribs).forEach(name => {
          contributorNames.add(name)
        })

        setAllContributors(Array.from(contributorNames).sort())
      } catch (error) {
        console.error('Failed to load leaderboard data:', error)
        // If leaderboard fails, at least show manual contributors
        setAllContributors(Object.keys(manualContribs).sort())
      }

      setLoading(false)
    } catch (error) {
      console.error('Failed to load contributors:', error)
      setMessage({ type: 'error', text: 'Failed to load contributors' })
      setLoading(false)
    }
  }

  const saveContributors = async (contributionsToSave = null) => {
    try {
      setLoading(true)

      // Use provided contributions or fall back to current state
      const contributions = contributionsToSave !== null ? contributionsToSave : manualContributions

      // Prepare the file content
      const contributionsFileContent = {
        "_instructions": "Manually assign additional contribution scores here. This file won't be overwritten by the analysis script.",
        "_scoring_guide": {
          "paper_publication": "20-50 points per paper",
          "conference_talk": "15-30 points",
          "blog_post": "10-20 points",
          "community_advocacy": "5-15 points",
          "mentorship": "10-25 points",
          "issue_triage": "5-10 points"
        },
        "contributors": contributions
      }

      // 1. FIRST: Update local file via API (for immediate development updates)
      let apiSuccess = false
      try {
        setMessage({ type: 'info', text: '🔄 Saving changes and regenerating leaderboard data... (this may take 15-20 seconds)' })

        const localApiResponse = await fetch(API_ENDPOINTS.updateManualContributions, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contributionsFileContent)
        })

        if (localApiResponse.ok) {
          const result = await localApiResponse.json()
          console.log('✅ Local file updated:', result.message)
          apiSuccess = true
          setMessage({
            type: 'success',
            text: '✅ Leaderboard data regenerated! Refresh the main leaderboard page to see changes.'
          })
        } else {
          console.warn('⚠️ Local API not available (probably not running in dev mode)')
        }
      } catch (error) {
        console.warn('⚠️ Local API not available:', error.message)
        // This is OK - local API might not be running in production
      }

      // 2. THEN: Commit to GitHub (for version control and production)
      const octokit = new Octokit({ auth: githubToken })

      const owner = import.meta.env.VITE_GITHUB_REPO_OWNER || 'cdc542559455'
      const repo = import.meta.env.VITE_GITHUB_REPO_NAME || 'LMCache'
      const path = 'manual-contributions.json'
      const branchName = 'leaderboard-updates'

      // Get the default branch (usually 'main' or 'master')
      const { data: repoData } = await octokit.repos.get({ owner, repo })
      const defaultBranch = repoData.default_branch

      // Get the SHA of the default branch
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`
      })
      const defaultBranchSha = refData.object.sha

      // Try to create or update the leaderboard-updates branch
      try {
        // Try to get existing branch
        await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${branchName}`
        })
        // Branch exists, update it to point to latest default branch
        await octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${branchName}`,
          sha: defaultBranchSha,
          force: true
        })
      } catch (error) {
        // Branch doesn't exist, create it
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: defaultBranchSha
        })
      }

      // Get current file SHA from the branch
      let sha = null
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branchName
        })
        sha = data.sha
      } catch (e) {
        // File doesn't exist yet
      }

      // Encode file content for GitHub API
      const content = btoa(JSON.stringify(contributionsFileContent, null, 2))

      // Commit the file to the branch
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `📝 Update manual contributions via admin panel\n\nUpdated by ${user.login}`,
        content,
        sha,
        branch: branchName
      })

      // Only show GitHub success message if local API didn't work
      if (!apiSuccess) {
        setMessage({ type: 'success', text: `✅ Changes saved to branch '${branchName}'!` })
      }

      setEditingContributor(null)
      setNewContributor({ name: '', score: 0, notes: '' })
      setLoading(false)

      // Trigger a message to inform user about PR workflow
      setTimeout(() => {
        if (!apiSuccess) {
          setMessage({
            type: 'info',
            text: `Changes committed to '${branchName}' branch! Create a PR to merge to main.`
          })
        }
      }, 2000)

    } catch (error) {
      console.error('Failed to save:', error)
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` })
      setLoading(false)
    }
  }

  const handleEdit = (name) => {
    setEditingContributor({
      name,
      score: manualContributions[name]?.score || 0,
      notes: manualContributions[name]?.notes || ''
    })
  }

  const handleSaveEdit = () => {
    if (!editingContributor.name) return

    const updated = {
      ...manualContributions,
      [editingContributor.name]: {
        score: parseInt(editingContributor.score) || 0,
        notes: editingContributor.notes
      }
    }

    setManualContributions(updated)
    setEditingContributor(null)

    // Pass the updated contributions directly to avoid race condition
    saveContributors(updated)
  }

  const handleAddNew = () => {
    const contributorName = newContributor.name.trim()

    if (!contributorName) {
      setMessage({ type: 'error', text: 'Contributor name is required' })
      return
    }

    // Check for case-insensitive duplicates
    const existingNames = Object.keys(manualContributions).map(n => n.toLowerCase())
    if (existingNames.includes(contributorName.toLowerCase())) {
      setMessage({ type: 'error', text: `Contributor "${contributorName}" already exists (case-insensitive check)` })
      return
    }

    const updated = {
      ...manualContributions,
      [contributorName]: {
        score: parseInt(newContributor.score) || 0,
        notes: newContributor.notes
      }
    }

    setManualContributions(updated)
    setNewContributor({ name: '', score: 0, notes: '' })

    // Pass the updated contributions directly to avoid race condition
    saveContributors(updated)
  }

  const handleAddContribution = (contributorName) => {
    if (!newContribution.score || newContribution.score <= 0) {
      setMessage({ type: 'error', text: 'Score must be greater than 0' })
      return
    }

    const updated = { ...manualContributions }

    // Initialize contributor if doesn't exist
    if (!updated[contributorName]) {
      updated[contributorName] = { contributions: [] }
    }

    // Add new contribution
    updated[contributorName].contributions.push({
      score: parseInt(newContribution.score),
      notes: newContribution.notes,
      start_date: newContribution.start_date || null,
      end_date: newContribution.end_date || null
    })

    setManualContributions(updated)
    setAddingContributionFor(null)
    setNewContribution({ score: 0, notes: '', start_date: '', end_date: '' })

    // Save
    saveContributors(updated)
  }

  const handleDeleteContribution = (contributorName, contributionIndex) => {
    if (!confirm('Delete this contribution?')) return

    const updated = { ...manualContributions }
    updated[contributorName].contributions.splice(contributionIndex, 1)

    // If no contributions left, remove contributor entirely
    if (updated[contributorName].contributions.length === 0) {
      delete updated[contributorName]
    }

    setManualContributions(updated)
    saveContributors(updated)
  }

  const handleDelete = (name) => {
    if (!confirm(`Delete ALL contributions for ${name}?`)) return

    const updated = { ...manualContributions }
    delete updated[name]
    setManualContributions(updated)

    // Pass the updated contributions directly to avoid race condition
    saveContributors(updated)
  }

  const handleCreateNewContributor = () => {
    const name = newContributorForm.name.trim()
    const email = newContributorForm.email.trim()

    if (!name) {
      setMessage({ type: 'error', text: 'Contributor name is required' })
      return
    }

    if (!newContributorForm.score || newContributorForm.score <= 0) {
      setMessage({ type: 'error', text: 'Initial contribution score must be greater than 0' })
      return
    }

    // Check if contributor already exists
    if (manualContributions[name]) {
      setMessage({ type: 'error', text: `Contributor "${name}" already exists. Use the "Add Contribution" button instead.` })
      return
    }

    const updated = { ...manualContributions }

    // Create new contributor with initial contribution
    updated[name] = {
      email: email || null,
      contributions: [{
        score: parseInt(newContributorForm.score),
        notes: newContributorForm.notes || '',
        start_date: newContributorForm.start_date || null,
        end_date: newContributorForm.end_date || null
      }]
    }

    setManualContributions(updated)
    setShowAddNewContributor(false)
    setNewContributorForm({ name: '', email: '', score: 0, notes: '', start_date: '', end_date: '' })

    // Add to allContributors list if not already there
    if (!allContributors.includes(name)) {
      setAllContributors([...allContributors, name].sort())
    }

    // Save
    saveContributors(updated)
  }

  const handleExportManualContributions = async () => {
    try {
      setMessage({ type: 'info', text: '📥 Downloading manual contributions backup...' })

      const response = await fetch(API_ENDPOINTS.exportManualContributions)

      if (!response.ok) {
        throw new Error('Failed to export manual contributions')
      }

      const data = await response.json()

      // Create a blob and download the file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `manual-contributions-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setMessage({ type: 'success', text: '✅ Manual contributions exported successfully!' })
    } catch (error) {
      console.error('Export failed:', error)
      setMessage({
        type: 'error',
        text: `Failed to export: ${error.message}`
      })
    }
  }

  const handlePullAndRefresh = async () => {
    if (!confirm('Pull latest data from official LMCache repository and regenerate leaderboard?\n\nThis will:\n1. Fetch latest commits from https://github.com/LMCache/LMCache\n2. Force update local repository\n3. Regenerate all leaderboard data\n\nThis may take 30-60 seconds.')) {
      return
    }

    setRefreshing(true)
    setMessage({ type: 'info', text: '🔄 Pulling from official LMCache repository... (this may take 30-60 seconds)' })

    try {
      const response = await fetch(API_ENDPOINTS.pullAndRefresh, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const result = await response.json()

      if (result.success) {
        setLastRefresh(new Date(result.timestamp))
        setMessage({
          type: 'success',
          text: `✅ Successfully refreshed from official LMCache repo!\n\nLatest commit: ${result.latestCommit}\n\nRefresh the main leaderboard page to see updates.`
        })

        // Reload contributors to get fresh data
        await loadContributors(githubToken)
      } else {
        setMessage({
          type: 'error',
          text: `Failed to refresh: ${result.error}`
        })
      }
    } catch (error) {
      console.error('Pull and refresh failed:', error)
      setMessage({
        type: 'error',
        text: `Failed to pull and refresh: ${error.message}\n\nMake sure the local API server is running (npm run api)`
      })
    } finally {
      setRefreshing(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-lm-orange">🔑 Admin Login</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Enter your GitHub Personal Access Token to manage manual contribution scores.
              </p>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,user:email&description=LMCache%20Leaderboard%20Admin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-lm-blue hover:underline"
              >
                📝 Create a new GitHub token →
              </a>
              <p className="text-xs text-gray-500 mt-2">
                Required scopes: <code className="bg-gray-100 px-1 rounded">repo</code> and <code className="bg-gray-100 px-1 rounded">user:email</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                GitHub Personal Access Token
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lm-orange"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {message && (
              <div className={`p-3 rounded text-sm ${
                message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {message.text}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full btn-primary"
            >
              Sign In
            </button>

            <p className="text-xs text-gray-500 text-center">
              Your token is stored locally and never sent to any server except GitHub.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Access denied screen - authenticated but not authorized
  if (isAuthenticated && !isAuthorized) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-red-600">🚫 Access Denied</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          <div className="space-y-4">
            <div className="text-center">
              <div className="text-6xl mb-4">🔒</div>
              <p className="text-lg font-semibold text-gray-900 mb-2">
                You are not authorized to access this admin panel.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Logged in as: <span className="font-semibold">{user?.email || user?.login}</span>
              </p>
            </div>

            {message && (
              <div className="p-3 rounded text-sm bg-red-100 text-red-700">
                {message.text}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Need access?</strong> Contact the primary admin:
              </p>
              <p className="text-sm text-blue-900 mt-2">
                📧 <a href="mailto:lokichen3@gmail.com" className="font-semibold underline">lokichen3@gmail.com</a>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold"
              >
                Logout
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-lm-orange text-white hover:bg-lm-orange-light rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-6 max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-lm-orange" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            <div>
              <h2 className="text-2xl font-bold text-lm-orange">Admin Panel</h2>
              <p className="text-sm text-gray-600">Logged in as: <span className="font-semibold">{user?.login}</span></p>
              {lastRefresh && (
                <p className="text-xs text-gray-500 mt-1">
                  Last refresh: {lastRefresh.toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleExportManualContributions}
              className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              title="Export manual contributions as backup"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
              </svg>
              Export Backup
            </button>
            <button
              onClick={handlePullAndRefresh}
              disabled={refreshing}
              className="px-4 py-2 text-sm bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all"
            >
              {refreshing ? '🔄 Refreshing...' : '🔄 Pull from Official Repo'}
            </button>
            <button onClick={handleLogout} className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">
              Logout
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Add New Contributor Section */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-lm-orange" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-lm-orange">Add New Contributor</h3>
                <p className="text-xs text-gray-600 mt-1">
                  For contributors without commits (e.g., PMs, advisors, community managers)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddNewContributor(!showAddNewContributor)}
              className="px-4 py-2 bg-lm-orange text-white rounded-lg hover:bg-lm-orange-light font-semibold text-sm flex items-center gap-2"
            >
              {showAddNewContributor ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Create New
                </>
              )}
            </button>
          </div>

          {showAddNewContributor && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-blue-300 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newContributorForm.name}
                    onChange={(e) => setNewContributorForm({ ...newContributorForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-lm-orange text-sm"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={newContributorForm.email}
                    onChange={(e) => setNewContributorForm({ ...newContributorForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-lm-orange text-sm"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Initial Contribution Score *</label>
                <input
                  type="number"
                  value={newContributorForm.score}
                  onChange={(e) => setNewContributorForm({ ...newContributorForm, score: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-lm-orange text-sm"
                  placeholder="e.g., 25"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={newContributorForm.notes}
                  onChange={(e) => setNewContributorForm({ ...newContributorForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-lm-orange text-sm"
                  placeholder="e.g., Project management, community advocacy, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date (optional)</label>
                  <input
                    type="date"
                    value={newContributorForm.start_date}
                    onChange={(e) => setNewContributorForm({ ...newContributorForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-lm-orange text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={newContributorForm.end_date}
                    onChange={(e) => setNewContributorForm({ ...newContributorForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-lm-orange text-sm"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">Leave dates blank to apply to all time periods</p>

              <button
                onClick={handleCreateNewContributor}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 font-semibold shadow-md hover:shadow-lg transition-all"
              >
                ✅ Create Contributor
              </button>
            </div>
          )}
        </div>

        {/* Contributors List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold">
                📋 All Contributors ({allContributors.length})
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {Object.keys(manualContributions).length} with manual "Other Contrib" scores (synced with manual-contributions.json)
              </p>
            </div>
            <input
              type="text"
              placeholder="Search contributors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-lm-orange text-sm"
            />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allContributors
              .filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(name => {
                const manualScore = manualContributions[name]
                return (
                  <div key={name} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {editingContributor?.name === name ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingContributor.name}
                          onChange={(e) => setEditingContributor({ ...editingContributor, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded font-semibold"
                          disabled
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={editingContributor.score}
                            onChange={(e) => setEditingContributor({ ...editingContributor, score: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded"
                            placeholder="Score"
                          />
                          <input
                            type="text"
                            value={editingContributor.notes}
                            onChange={(e) => setEditingContributor({ ...editingContributor, notes: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded"
                            placeholder="Notes"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="px-4 py-2 bg-lm-orange text-white rounded hover:bg-lm-orange-light"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingContributor(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-gray-900 mb-2">{name}</div>

                        {/* List contributions */}
                        {manualScore?.contributions && manualScore.contributions.length > 0 ? (
                          <div className="space-y-2 mb-2">
                            {manualScore.contributions.map((contrib, idx) => (
                              <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200">
                                <div className="flex justify-between items-start">
                                  <div className="text-sm flex-1">
                                    <span className="font-semibold text-orange-600">+{contrib.score}</span>
                                    {contrib.notes && <span className="text-gray-600"> • {contrib.notes}</span>}
                                    <div className="text-xs text-gray-500 mt-1">
                                      {contrib.start_date || contrib.end_date ? (
                                        <>
                                          {contrib.start_date ? `From ${contrib.start_date}` : 'Until'}
                                          {contrib.end_date ? ` to ${contrib.end_date}` : ' ongoing'}
                                        </>
                                      ) : (
                                        'All periods'
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteContribution(name, idx)}
                                    className="text-red-600 hover:text-red-800 text-xs ml-2"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 italic mb-2">No contributions yet</div>
                        )}

                        {/* Add contribution form */}
                        {addingContributionFor === name ? (
                          <div className="p-3 bg-blue-50 rounded border border-blue-200 space-y-2">
                            <input
                              type="number"
                              value={newContribution.score}
                              onChange={(e) => setNewContribution({ ...newContribution, score: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Score"
                            />
                            <input
                              type="text"
                              value={newContribution.notes}
                              onChange={(e) => setNewContribution({ ...newContribution, notes: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Notes (e.g., 'Published paper at MLSys')"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={newContribution.start_date}
                                onChange={(e) => setNewContribution({ ...newContribution, start_date: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Start (optional)"
                              />
                              <input
                                type="date"
                                value={newContribution.end_date}
                                onChange={(e) => setNewContribution({ ...newContribution, end_date: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="End (optional)"
                              />
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              Leave dates blank for all periods
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddContribution(name)}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => {
                                  setAddingContributionFor(null)
                                  setNewContribution({ score: 0, notes: '', start_date: '', end_date: '' })
                                }}
                                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAddingContributionFor(name)}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                            >
                              + Add Contribution
                            </button>
                            {manualScore?.contributions && manualScore.contributions.length > 0 && (
                              <button
                                onClick={() => handleDelete(name)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                              >
                                Delete All
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Admin Management Section */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <button
            onClick={() => setShowAdminManager(!showAdminManager)}
            className="flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-lm-orange to-lm-orange-light text-white rounded-lg hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              <span className="font-semibold">Manage Admins</span>
            </div>
            <span className="text-xl">{showAdminManager ? '▼' : '▶'}</span>
          </button>

          {showAdminManager && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-lm-orange" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <h3 className="text-lg font-semibold">Invite New Admin</h3>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="admin@example.com or github-username"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-lm-orange"
                  />
                  <button
                    onClick={handleAddAdmin}
                    disabled={loading}
                    className="px-4 py-2 bg-lm-orange text-white rounded-lg hover:bg-lm-orange-light disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Add Admin'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enter either a GitHub email address or GitHub username. Both work!
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-lm-orange" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                  <h3 className="text-lg font-semibold">Current Admins</h3>
                </div>

                {/* Primary Admin (Hardcoded) */}
                <div className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-gray-900">
                        {AUTHORIZED_ADMINS[0]} / {AUTHORIZED_ADMINS[1]}
                      </span>
                      <span className="ml-2 px-2 py-1 bg-yellow-500 text-yellow-900 text-xs font-bold rounded">PRIMARY ADMIN</span>
                    </div>
                    <span className="text-sm text-gray-500">Cannot be removed</span>
                  </div>
                </div>

                {/* Additional Admins */}
                {admins.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No additional admins yet</p>
                ) : (
                  <div className="space-y-2">
                    {admins.map(email => (
                      <div key={email} className="p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-gray-900">{email}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveAdmin(email)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <div>
              <strong>Workflow:</strong>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                <li>Changes are saved to the <code className="bg-white px-1 rounded">leaderboard-updates</code> branch</li>
                <li>Create a Pull Request to merge to main branch</li>
                <li>After merging, run the analysis script to update the dashboard:</li>
              </ol>
              <code className="block mt-2 p-2 bg-white rounded text-xs">
                python3 analyze_commits.py --repo ./LMCache --output dashboard/public/leaderboard-data.json
              </code>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel
