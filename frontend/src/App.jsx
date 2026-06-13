import { useState } from 'react'
import MeetingInput from './components/MeetingInput'
import StatusPoller from './components/StatusPoller'
import TicketReview from './components/TicketReview'
import Summary from './components/Summary'

const STEPS = ['Start', 'Recording', 'Review', 'Done']

function StepBar({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`flex items-center gap-1.5 ${i <= current ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                i < current
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : i === current
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{step}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 sm:w-16 h-0.5 mx-2 ${i < current ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [step, setStep] = useState(0)
  const [botId, setBotId] = useState(null)
  const [tickets, setTickets] = useState([])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gray-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold tracking-tight">MeetMind</span>
          </div>
          <span className="text-gray-400 text-sm hidden sm:inline">AI Meeting Assistant</span>
        </div>
      </header>

      <div className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4">
          <StepBar current={step} />
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {step === 0 && (
            <MeetingInput onStarted={(id) => { setBotId(id); setStep(1) }} />
          )}
          {step === 1 && (
            <StatusPoller
              botId={botId}
              onTicketsReady={(t) => { setTickets(t); setStep(2) }}
            />
          )}
          {step === 2 && (
            <TicketReview
              botId={botId}
              tickets={tickets}
              onComplete={() => setStep(3)}
            />
          )}
          {step === 3 && <Summary botId={botId} />}
        </div>
      </main>
    </div>
  )
}
