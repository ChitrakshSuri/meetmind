import { useEffect, useState } from 'react'
import { getSummary } from '../api/client'

const CONFETTI_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    size: 6 + Math.random() * 6,
    duration: 2.5 + Math.random() * 1.5,
  }))

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: absolute;
          top: 0;
          border-radius: 2px;
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export default function Summary({ botId }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    getSummary(botId)
      .then((res) => setSummary(res.data.summary))
      .catch((err) => setError(err.response?.data?.detail || err.message || 'Failed to load summary'))
      .finally(() => setLoading(false))

    const timer = setTimeout(() => setShowConfetti(false), 4000)
    return () => clearTimeout(timer)
  }, [botId])

  return (
    <>
      {showConfetti && <Confetti />}

      <div className="bg-white rounded-2xl shadow-md p-8 text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">All done!</h2>
        <p className="text-gray-500 text-sm mb-6">
          ✅ Your tickets have been pushed to Jira successfully.
        </p>

        {loading && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 text-left">
            {error}
          </div>
        )}

        {summary && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left text-sm text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Meeting Summary</p>
            {summary}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://chitrakshsworkspace-40359508.atlassian.net/jira/software/projects/KAN/boards/1"
            target="_blank"
            rel="noreferrer"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-6 py-2.5 transition-colors text-sm inline-flex items-center justify-center gap-1.5"
          >
            View Jira Board →
          </a>
          <button
            onClick={() => window.location.reload()}
            className="border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-lg px-6 py-2.5 transition-colors text-sm"
          >
            Start New Meeting
          </button>
        </div>
      </div>
    </>
  )
}
