import { useEffect, useRef, useState } from 'react'
import { getMeetingStatus, getTickets } from '../api/client'

const STATUS_MESSAGES = {
  bot_created: '🤖 Bot is joining your meeting...',
  processing: '🤖 Bot is joining your meeting...',
  in_call_not_recording: '🤖 Bot has joined, waiting to record...',
  in_call_recording: '🔴 Recording in progress',
  recording_succeeded: '⚙️ Processing recording...',
  completed: '⚙️ Processing recording...',
  agent_running: '⚙️ AI is analyzing your meeting...',
}

export default function StatusPoller({ botId, onTicketsReady }) {
  const [statusMsg, setStatusMsg] = useState('🤖 Connecting...')
  const [phase, setPhase] = useState('status')
  const phaseRef = useRef('status')
  const intervalRef = useRef(null)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    async function poll() {
      if (phaseRef.current === 'status') {
        try {
          const res = await getMeetingStatus(botId)
          const status = res.data.status
          setStatusMsg(STATUS_MESSAGES[status] || `Status: ${status}`)
          if (status === 'completed' || status === 'agent_running') {
            setPhase('tickets')
            phaseRef.current = 'tickets'
          }
        } catch {
          // keep polling silently
        }
      } else {
        try {
          const res = await getTickets(botId)
          const tickets = res.data.tickets || []
          if (tickets.length > 0) {
            clearInterval(intervalRef.current)
            onTicketsReady(tickets)
          } else {
            setStatusMsg('⚙️ AI is generating your tickets...')
          }
        } catch {
          // keep polling silently
        }
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 5000)
    return () => clearInterval(intervalRef.current)
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
        <p className="text-lg font-semibold text-gray-800">{statusMsg}</p>
        <p className="text-sm text-gray-500 mt-1">This page updates automatically. You can leave it open.</p>
      </div>

      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
