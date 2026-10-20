import { useEffect, useRef, useState } from 'react'
import { getMeetingStatus, getTickets, getSummary } from '../api/client'
import { CheckIcon, AlertIcon } from './ui'

// The pipeline the bot runs through. Each backend status maps to one stage.
const STAGES = [
  { label: 'Joining the call', hint: 'The bot is entering your meeting.' },
  { label: 'Recording', hint: 'Capturing audio while the meeting runs.' },
  { label: 'Processing the recording', hint: 'Transcribing what was said.' },
  { label: 'Drafting tickets', hint: 'The AI is reading the transcript for action items.' },
]

const STATUS_MESSAGES = {
  bot_created: { stage: 0, text: 'Bot is joining your meeting…' },
  processing: { stage: 0, text: 'Bot is joining your meeting…' },
  in_call_not_recording: { stage: 0, text: 'Bot has joined, waiting to record…' },
  in_call_recording: { stage: 1, text: 'Recording in progress' },
  recording_succeeded: { stage: 2, text: 'Processing recording…' },
  completed: { stage: 3, text: 'AI is analyzing your meeting…' },
  agent_running: { stage: 3, text: 'AI is analyzing your meeting…' },
  no_tickets_needed: { stage: 3, text: 'Meeting analyzed — no action items detected' },
}

const TICKET_BACKOFF = [10000, 15000, 20000, 30000]
const MAX_TICKET_WAIT_MS = 5 * 60 * 1000

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function StatusPoller({ botId, onTicketsReady, onNoTickets }) {
  const [status, setStatus] = useState({ stage: 0, text: 'Connecting…' })
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const timeoutRef = useRef(null)
  const startTimeRef = useRef(null)
  const backoffIndexRef = useRef(0)
  const stoppedRef = useRef(false)

  // Elapsed time since this screen opened; stops when polling does.
  useEffect(() => {
    if (error) return
    const started = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(id)
  }, [error])

  useEffect(() => {
    stoppedRef.current = false
    startTimeRef.current = null
    backoffIndexRef.current = 0

    function applyStatus(raw) {
      const known = STATUS_MESSAGES[raw]
      if (known) setStatus(known)
      else setStatus((prev) => ({ stage: prev.stage, text: `Status: ${raw}` }))
    }

    function scheduleTicketPoll() {
      if (stoppedRef.current) return

      const elapsedMs = Date.now() - startTimeRef.current
      if (elapsedMs >= MAX_TICKET_WAIT_MS) {
        setError('Taking longer than expected. Please refresh.')
        return
      }

      const delay = TICKET_BACKOFF[Math.min(backoffIndexRef.current, TICKET_BACKOFF.length - 1)]

      timeoutRef.current = setTimeout(async () => {
        if (stoppedRef.current) return
        try {
          const res = await getTickets(botId)
          const tickets = res.data.tickets || []
          if (tickets.length > 0) {
            stoppedRef.current = true
            onTicketsReady(tickets)
            return
          }

          // Check if summary already exists — means decide_ticket_creation
          // skipped ticket generation entirely and the pipeline is done
          try {
            const summaryRes = await getSummary(botId)
            if (summaryRes.data.summary && summaryRes.data.summary.length > 0) {
              stoppedRef.current = true
              setStatus({ stage: 3, text: 'No action items detected — generating summary…' })
              onNoTickets()
              return
            }
          } catch {
            // summary not ready yet, keep polling tickets
          }

          setStatus({ stage: 3, text: 'AI is generating your tickets…' })
        } catch {
          // keep going
        }
        backoffIndexRef.current += 1
        scheduleTicketPoll()
      }, delay)
    }

    function scheduleStatusPoll() {
      if (stoppedRef.current) return
      timeoutRef.current = setTimeout(async () => {
        if (stoppedRef.current) return
        try {
          const res = await getMeetingStatus(botId)
          const current = res.data.status
          applyStatus(current)
          if (current === 'completed' || current === 'agent_running') {
            startTimeRef.current = Date.now()
            scheduleTicketPoll()
            return
          }
        } catch {
          // keep going
        }
        scheduleStatusPoll()
      }, 5000)
    }

    // Kick off with an immediate status check, then schedule
    async function init() {
      try {
        const res = await getMeetingStatus(botId)
        const current = res.data.status
        applyStatus(current)
        if (current === 'completed' || current === 'agent_running') {
          startTimeRef.current = Date.now()
          scheduleTicketPoll()
          return
        }
      } catch {
        // fall through to regular polling
      }
      scheduleStatusPoll()
    }

    init()
    return () => {
      stoppedRef.current = true
      clearTimeout(timeoutRef.current)
    }
  }, [botId]) // eslint-disable-line react-hooks/exhaustive-deps

  const isRecording = status.stage === 1

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{isRecording ? 'Recording Your Meeting' : 'Working on Your Meeting'}</h1>
          <p className="mt-1 text-[15px] text-muted">This page updates automatically. You can leave it open.</p>
        </div>
        {!error && (
          <p className="text-[13px] text-muted">
            Elapsed <span className="num font-medium text-ink">{formatElapsed(elapsed)}</span>
          </p>
        )}
      </div>

      <div className="panel mt-8 overflow-hidden">
        <div className="border-b border-rule px-6 py-5" role="status" aria-live="polite">
          {error ? (
            <p className="flex items-start gap-2 font-medium text-negative">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : (
            <>
              <p className="text-lg font-medium tracking-[-0.01em]">{status.text}</p>
              <p className="mt-0.5 text-[13px] text-muted">{STAGES[status.stage].hint}</p>
            </>
          )}
        </div>

        <ol className="divide-y divide-rule">
          {STAGES.map((stage, i) => {
            const done = i < status.stage
            const active = i === status.stage && !error
            return (
              <li key={stage.label} className="flex items-center gap-3 px-6 py-3.5" aria-current={active ? 'step' : undefined}>
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                  {done ? (
                    <CheckIcon className="h-4 w-4 text-ink" />
                  ) : active ? (
                    <>
                      <span className="live-ring absolute h-2 w-2 rounded-full bg-signal" />
                      <span className="relative h-2 w-2 rounded-full bg-signal" />
                    </>
                  ) : (
                    <span className="h-2 w-2 rounded-full border border-control" />
                  )}
                </span>
                <span className={`flex-1 ${done || active ? 'text-ink' : 'text-muted'} ${active ? 'font-medium' : ''}`}>
                  {stage.label}
                </span>
                <span className="text-xs text-muted">{done ? 'Done' : active ? 'In progress' : 'Waiting'}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
