import { useEffect, useState } from 'react'
import MeetingInput from './components/MeetingInput'
import StatusPoller from './components/StatusPoller'
import TicketReview from './components/TicketReview'
import Summary from './components/Summary'
import Home from './components/Home'
import { Mark, CheckIcon } from './components/ui'

const STEPS = ['Start', 'Recording', 'Review', 'Done']

function StepBar({ current }) {
  return (
    <nav aria-label="Progress">
      <ol className="grid grid-cols-4 gap-3">
        {STEPS.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li
              key={step}
              aria-current={active ? 'step' : undefined}
              className={`flex items-center gap-1.5 border-t-2 pt-2.5 text-[13px] ${
                done ? 'border-primary text-ink' : active ? 'border-signal font-medium text-ink' : 'border-control text-muted'
              }`}
            >
              {done && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{step}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Tool({ onHome }) {
  const [step, setStep] = useState(0)
  const [botId, setBotId] = useState(null)
  const [tickets, setTickets] = useState([])
  const [ticketsPushed, setTicketsPushed] = useState(false)
  const [pushedCount, setPushedCount] = useState(0)

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to Content
      </a>

      <header className="border-b border-line">
        <div className="mx-auto flex h-12 w-full max-w-[960px] items-center justify-between px-4 sm:px-6">
          {(() => {
            const brand = (
              <>
                <Mark />
                <span className="text-[15px] font-semibold tracking-[-0.01em]" translate="no">
                  MeetMind
                </span>
              </>
            )
            // Leaving mid-run would drop the live meeting, so the logo only links home before a bot is sent.
            return step === 0 ? (
              <a href="#" onClick={(e) => { e.preventDefault(); onHome() }} className="flex items-center gap-2 text-ink" aria-label="MeetMind home">
                {brand}
              </a>
            ) : (
              <div className="flex items-center gap-2 text-ink">{brand}</div>
            )
          })()}
          {botId && (
            <p className="flex min-w-0 items-center gap-2 text-xs text-muted">
              <span className="hidden sm:inline">Meeting bot</span>
              <span className="truncate rounded-[4px] bg-raised px-1.5 py-0.5 font-mono text-[#3d3d3d]" title={botId}>
                {String(botId).slice(0, 8)}
              </span>
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[960px] px-4 pt-6 sm:px-6">
        <StepBar current={step} />
      </div>

      <main id="main" className="mx-auto w-full max-w-[960px] flex-1 px-4 pb-16 pt-8 sm:px-6">
        <div key={step} className="screen-in">
          {step === 0 && (
            <MeetingInput
              onStarted={(id) => {
                setBotId(id)
                setStep(1)
              }}
            />
          )}
          {step === 1 && (
            <StatusPoller
              botId={botId}
              onTicketsReady={(t) => {
                setTickets(t)
                setStep(2)
              }}
              onNoTickets={() => {
                setStep(3)
              }}
            />
          )}
          {step === 2 && (
            <TicketReview
              botId={botId}
              tickets={tickets}
              onComplete={(pushed, count = 0) => {
                setTicketsPushed(pushed)
                setPushedCount(count)
                setStep(3)
              }}
            />
          )}
          {step === 3 && <Summary botId={botId} ticketsPushed={ticketsPushed} pushedCount={pushedCount} />}
        </div>
      </main>
    </div>
  )
}

// The home page is the front door; the tool lives behind #start so Back returns to it.
export default function App() {
  const [view, setView] = useState(() => (window.location.hash === '#start' ? 'tool' : 'home'))

  useEffect(() => {
    const sync = () => {
      const next = window.location.hash === '#start' ? 'tool' : 'home'
      setView((cur) => (cur === next ? cur : next))
      if (next === 'tool') window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function go(to) {
    if (to === 'tool') window.location.hash = '#start'
    else history.pushState(null, '', window.location.pathname + window.location.search)
    setView(to)
    window.scrollTo(0, 0)
  }

  return view === 'tool' ? <Tool onHome={() => go('home')} /> : <Home onStart={() => go('tool')} />
}
