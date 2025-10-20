import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function ContributionChart({ data, currentPeriod, timePeriodType }) {
  if (!data) return null

  // Sort periods chronologically
  const periods = Object.keys(data).sort()

  // Aggregate data for each period
  const chartData = periods.map(period => {
    const contributors = data[period]
    return {
      period,
      totalCommits: contributors.reduce((sum, c) => sum + c.total_commits, 0),
      significantCommits: contributors.reduce((sum, c) => sum + c.significant_commits, 0),
      simpleCommits: contributors.reduce((sum, c) => sum + c.simple_commits, 0),
      contributors: contributors.length
    }
  })

  const chartConfig = {
    labels: chartData.map(d => d.period),
    datasets: [
      {
        label: 'Significant Commits',
        data: chartData.map(d => d.significantCommits),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Simple Commits',
        data: chartData.map(d => d.simpleCommits),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Contributors',
        data: chartData.map(d => d.contributors),
        borderColor: '#ea580c',
        backgroundColor: 'rgba(234, 88, 12, 0.15)',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y1'
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#1f2937',
          font: {
            size: 13,
            weight: '600',
            family: 'Roboto'
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      title: {
        display: true,
        text: `Contribution Trends (${timePeriodType})`,
        color: '#5928e5',
        font: {
          size: 18,
          weight: 'bold',
          family: 'Roboto'
        },
        padding: {
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: '#5928e5',
        borderWidth: 2,
        padding: 12,
        displayColors: true,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(156, 163, 175, 0.2)'
        },
        ticks: {
          color: '#374151',
          font: {
            family: 'Roboto',
            size: 12,
            weight: '500'
          }
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: {
          color: 'rgba(156, 163, 175, 0.2)'
        },
        ticks: {
          color: '#374151',
          font: {
            family: 'Roboto',
            size: 12,
            weight: '500'
          }
        },
        title: {
          display: true,
          text: 'Commits',
          color: '#1f2937',
          font: {
            size: 14,
            weight: 'bold',
            family: 'Roboto'
          }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: '#ea580c',
          font: {
            family: 'Roboto',
            size: 12,
            weight: '600'
          }
        },
        title: {
          display: true,
          text: 'Contributors',
          color: '#ea580c',
          font: {
            size: 14,
            weight: 'bold',
            family: 'Roboto'
          }
        }
      }
    }
  }

  return (
    <div className="card p-6">
      <div className="h-80">
        <Line data={chartConfig} options={options} />
      </div>
    </div>
  )
}

export default ContributionChart
