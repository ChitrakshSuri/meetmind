import { useState } from 'react'
import { startMeeting } from '../api/client'
import { Spinner, AlertIcon } from './ui'

const HOW_IT_WORKS = [
  { title: 'The bot joins the call', body: 'MeetMind enters your Google Meet or Zoom call under the name you choose.' },
  { title: 'It records and transcribes', body: 'Leave the call running. This page tracks each stage as it happens.' },
  { title: 'You review the drafts', body: 'Edit, approve or skip every ticket. Nothing reaches Jira until you confirm.' },
]

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
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">New Meeting</h1>
      <p className="mt-1 max-w-[60ch] text-[15px] text-muted">
        Paste a Google Meet or Zoom link. MeetMind joins, records and turns the discussion into Jira tickets.
      </p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className="panel p-6">
          <div>
            <label htmlFor="meeting-url" className="field-label">
              Meeting URL
            </label>
            <input
              id="meeting-url"
              name="meeting_url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij…"
              className="field"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'start-error' : undefined}
              required
            />
          </div>

          <div className="mt-4">
            <label htmlFor="bot-name" className="field-label">
              Bot Name <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="bot-name"
              name="bot_name"
              type="text"
              autoComplete="off"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="MeetMind AI…"
              className="field"
            />
            <p className="mt-2 text-xs text-muted">Shown to everyone in the call as the participant name.</p>
          </div>

          {error && (
            <div
              id="start-error"
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-control border border-[#f3c9c6] bg-[#ffedea] px-3 py-2.5 text-[13px] text-[#831c1e]"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !url.trim()} className="btn btn-primary mt-6 w-full sm:w-auto">
            {loading ? (
              <>
                <Spinner /> Sending Bot…
              </>
            ) : (
              'Send Bot to Meeting'
            )}
          </button>
        </form>

        <aside aria-label="What happens next">
          <h2 className="text-base font-semibold">What Happens Next</h2>
          <ul className="mt-3 space-y-4">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.title} className="border-l-2 border-control pl-4">
                <p className="font-medium">{item.title}</p>
                <p className="mt-0.5 text-[13px] text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
