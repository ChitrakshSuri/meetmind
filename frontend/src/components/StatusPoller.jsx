import { useEffect, useRef, useState } from 'react'
import { getMeetingStatus, getTickets } from '../api/client'

const STATUS_MESSAGES = {
  bot_created: '🤖 Bot is joining your meeting...',
  processing: '🤖 Bot is joining your meeting...',
  in_call_not_recording: '🤖 Bot has joined, waiting to record...',
  in_call_recording: '🔴 Recording in progress',
  recording_succeeded: '⚙️ Processing recording...',
  completed: '⚙️ AI is analyzing your meeting...',
  agent_running: '⚙️ AI is analyzing your meeting...',
}

const TICKET_BACKOFF = [10000, 15000, 20000, 30000]
const MAX_TICKET_WAIT_MS = 5 * 60 * 1000

export default function StatusPoller({ botId, onTicketsReady }) {
  const [statusMsg, setStatusMsg] = useState('🤖 Connecting...')
  const [error, setError] = useState(null)
  const timeoutRef = useRef(null)
  const startTimeRef = useRef(null)
  const backoffIndexRef = useRef(0)
  const stoppedRef = useRef(false)

  useEffect(() => {
    stoppedRef.current = false
    startTimeRef.current = null
    backoffIndexRef.current = 0

    function scheduleTicketPoll() {
      if (stoppedRef.current) return

      const elapsed = Date.now() - startTimeRef.current
      if (elapsed >= MAX_TICKET_WAIT_MS) {
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
          setStatusMsg('⚙️ AI is generating your tickets...')
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
          const status = res.data.status
          setStatusMsg(STATUS_MESSAGES[status] || `Status: ${status}`)
          if (status === 'completed' || status === 'agent_running') {
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
        const status = res.data.status
        setStatusMsg(STATUS_MESSAGES[status] || `Status: ${status}`)
        if (status === 'completed' || status === 'agent_running') {
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

  return (
    <div className="bg-white rounded-2xl shadow-md p-10 flex flex-col items-center text-center gap-6">
      <div className="relative flex items-center justify-center">
        <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-indigo-400 opacity-25" />
        <span className="relative inline-flex rounded-full h-12 w-12 bg-indigo-600 items-center justify-center text-2xl">
          🧠
        </span>
      </div>

      <div>
        {error ? (
          <p className="text-sm font-medium text-red-600">{error}</p>
        ) : (
          <>
            <p className="text-lg font-semibold text-gray-800">{statusMsg}</p>
            <p className="text-sm text-gray-500 mt-1">This page updates automatically. You can leave it open.</p>
          </>
        )}
      </div>

      {!error && (
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
