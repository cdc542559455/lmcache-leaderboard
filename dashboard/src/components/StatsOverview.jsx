function StatsOverview({ totalCommits, significantCommits, simpleCommits, contributors }) {
  const significanceRate = totalCommits > 0 ? (significantCommits / totalCommits * 100).toFixed(1) : 0

  const StatIcon = ({ type, color }) => {
    const icons = {
      commits: (
        <svg className={`w-8 h-8 ${color}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      ),
      star: (
        <svg className={`w-8 h-8 ${color}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      ),
      wrench: (
        <svg className={`w-8 h-8 ${color}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
        </svg>
      ),
      users: (
        <svg className={`w-8 h-8 ${color}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      ),
      target: (
        <svg className={`w-8 h-8 ${color}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      )
    }
    return icons[type]
  }

  const stats = [
    {
      label: 'Total Commits',
      value: totalCommits,
      iconType: 'commits',
      color: 'text-lm-orange',
      bgColor: 'bg-orange-50',
      borderColor: 'border-lm-orange'
    },
    {
      label: 'Significant Changes',
      value: significantCommits,
      iconType: 'star',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500'
    },
    {
      label: 'Simple Fixes',
      value: simpleCommits,
      iconType: 'wrench',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500'
    },
    {
      label: 'Contributors',
      value: contributors,
      iconType: 'users',
      color: 'text-lm-orange',
      bgColor: 'bg-orange-50',
      borderColor: 'border-lm-orange'
    },
    {
      label: 'Significance Rate',
      value: `${significanceRate}%`,
      iconType: 'target',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-500'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`card p-6 ${stat.bgColor} border-l-4 ${stat.borderColor} hover:scale-105 transition-transform duration-200`}
        >
          <div className="flex items-center justify-between mb-2">
            <StatIcon type={stat.iconType} color={stat.color} />
            <span className={`text-3xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
          <div className="text-sm text-gray-700 font-semibold">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  )
}

export default StatsOverview
