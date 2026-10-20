import { useEffect, useState } from 'react'
import { getSummary } from '../api/client'
import { CheckIcon, ExternalIcon, AlertIcon } from './ui'

function SummarySkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading summary">
      <div className="skeleton h-4 w-11/12" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-9/12" />
      <div className="skeleton h-4 w-10/12" />
    </div>
  )
}

export default function Summary({ botId, ticketsPushed, pushedCount = 0 }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSummary(botId)
      .then((res) => setSummary(res.data.summary))
      .catch((err) => setError(err.response?.data?.detail || err.message || 'Failed to load summary'))
      .finally(() => setLoading(false))
  }, [botId])

  const jiraUrl = import.meta.env.VITE_JIRA_BOARD_URL || '#'

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Meeting Processed</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[15px] text-muted">
            {ticketsPushed ? (
              <>
                <CheckIcon className="h-4 w-4 shrink-0 text-positive" />
                <span>
                  <span className="num font-medium text-ink">{pushedCount}</span>{' '}
                  {pushedCount === 1 ? 'ticket' : 'tickets'} pushed to Jira.
                </span>
              </>
            ) : (
              'No tickets were pushed to Jira.'
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {ticketsPushed && (
            <a href={jiraUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              View Jira Board
              <ExternalIcon className="h-4 w-4" />
            </a>
          )}
          <button type="button" onClick={() => window.location.reload()} className="btn btn-secondary">
            Start New Meeting
          </button>
        </div>
      </div>

      <section className="panel mt-8 p-6" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-base font-semibold">
          Meeting Summary
        </h2>

        <div className="mt-4">
          {loading && <SummarySkeleton />}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-control border border-[#f3c9c6] bg-[#ffedea] px-3 py-2.5 text-[13px] text-[#831c1e]"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {summary && <p className="max-w-[68ch] whitespace-pre-wrap break-words text-[15px] leading-[1.7]">{summary}</p>}

          {!loading && !error && !summary && <p className="text-muted">No summary was generated for this meeting.</p>}
        </div>
      </section>
    </div>
  )
}
