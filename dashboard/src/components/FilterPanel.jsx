import { useState } from 'react'

function FilterPanel({ contributors, filteredContributors, setFilteredContributors }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showPanel, setShowPanel] = useState(false)

  const toggleContributor = (name) => {
    setFilteredContributors(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    )
  }

  const filteredList = contributors.filter(name =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="mt-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="px-4 py-2 bg-lm-orange text-white rounded-lg hover:bg-lm-orange-light font-semibold transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
          </svg>
          Filter Contributors
          {filteredContributors.length > 0 && (
            <span className="bg-white text-lm-orange px-2 py-0.5 rounded-full text-xs font-bold">
              {filteredContributors.length}
            </span>
          )}
        </button>

        {filteredContributors.length > 0 && (
          <button
            onClick={() => setFilteredContributors([])}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm"
          >
            Clear All
          </button>
        )}
      </div>

      {showPanel && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Search Box */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search contributors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lm-orange"
            />
          </div>

          {/* Contributor List */}
          <div className="max-h-96 overflow-y-auto space-y-1">
            {filteredList.map(name => {
              const isHidden = filteredContributors.includes(name)
              return (
                <div
                  key={name}
                  onClick={() => toggleContributor(name)}
                  className={`flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer transition-all ${
                    isHidden
                      ? 'bg-red-50 border border-red-200 hover:bg-red-100'
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className={`font-medium ${isHidden ? 'text-red-700 line-through' : 'text-gray-800'}`}>
                    {name}
                  </span>
                  {isHidden ? (
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.59-13L12 10.59 8.41 7 7 8.41 10.59 12 7 15.59 8.41 17 12 13.41 15.59 17 17 15.59 13.41 12 17 8.41z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  )}
                </div>
              )
            })}
          </div>

          {filteredList.length === 0 && (
            <p className="text-center text-gray-500 py-8">No contributors found</p>
          )}
        </div>
      )}
    </div>
  )
}

export default FilterPanel
