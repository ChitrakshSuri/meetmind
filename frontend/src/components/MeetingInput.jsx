import { useState } from 'react'
import { startMeeting } from '../api/client'

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export default function MeetingInput({ onStarted }) {
  const [url, setUrl] = useState('')
  const [botName, setBotName] = useState('MeetMind AI')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await startMeeting(url.trim(), botName.trim() || 'MeetMind AI')
      onStarted(res.data.bot_id)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to start meeting')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Start a Meeting</h2>
      <p className="text-gray-500 text-sm mb-6">
        Paste your Google Meet or Zoom link and MeetMind will join, record, and process it automatically.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Meeting URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bot Name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="MeetMind AI"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg px-6 py-3 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <><Spinner /> Sending bot...</> : 'Start MeetMind'}
        </button>
      </form>
    </div>
  )
}
