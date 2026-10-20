import { useEffect, useMemo, useRef, useState } from 'react'
import '../home.css'

// ── Reveal on scroll ──────────────────────────────────────────────────────────
// Content is visible without script; the root only hides .reveal once this has run.

function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || !('IntersectionObserver' in window)) return
    root.classList.add('js-reveal')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )
    root.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      root.classList.remove('js-reveal')
    }
  }, [rootRef])
}

function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  return (
    <Tag className={`reveal ${className}`} style={{ '--d': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  )
}

// ── Drawings ──────────────────────────────────────────────────────────────────

const STROKE = { stroke: 'var(--h-ink)', strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round' }

function Starburst({ className }) {
  const d = useMemo(() => {
    const spikes = 26
    const pts = []
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? 480 : 390 + ((i * 37) % 5) * 10
      const a = (Math.PI * i) / spikes
      pts.push(`${(500 + r * Math.cos(a)).toFixed(1)},${(500 + r * Math.sin(a)).toFixed(1)}`)
    }
    return `M${pts.join('L')}Z`
  }, [])
  return (
    <svg className={className} viewBox="0 0 1000 1000" aria-hidden="true">
      <path d={d} fill="var(--h-deep)" />
    </svg>
  )
}

function Mascot({ className }) {
  return (
    <svg className={className} viewBox="0 0 360 420" role="img" aria-label="MeetMind bot riding a skateboard, holding a ticket">
      {/* skateboard */}
      <rect x="86" y="372" width="190" height="16" rx="8" fill="var(--h-cream)" {...STROKE} />
      <circle cx="116" cy="400" r="10" fill="var(--h-orange)" {...STROKE} />
      <circle cx="246" cy="400" r="10" fill="var(--h-orange)" {...STROKE} />
      {/* legs + sneakers */}
      <path d="M152 284 L146 350M210 284 L216 350" fill="none" {...STROKE} strokeWidth={8} />
      <ellipse cx="140" cy="360" rx="30" ry="14" fill="var(--h-lime)" {...STROKE} />
      <ellipse cx="224" cy="360" rx="30" ry="14" fill="var(--h-lime)" {...STROKE} />
      {/* body */}
      <rect x="122" y="192" width="116" height="98" rx="34" fill="var(--h-orange)" {...STROKE} />
      <path d="M160 238 h40" fill="none" {...STROKE} strokeWidth={4} opacity=".5" />
      {/* ticket arm */}
      <path d="M128 228 Q108 240 100 250" fill="none" {...STROKE} strokeWidth={8} />
      <g transform="rotate(-10 70 235)">
        <rect x="26" y="204" width="92" height="68" rx="10" fill="var(--h-cream)" {...STROKE} />
        <path d="M40 224 h40M40 240 h56M40 256 h30" fill="none" {...STROKE} strokeWidth={4} />
        <path d="M86 218 l7 7 l13 -14" fill="none" stroke="#247b50" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* waving arm */}
      <path d="M236 224 Q284 214 296 168" fill="none" {...STROKE} strokeWidth={8} />
      <circle cx="298" cy="160" r="15" fill="var(--h-cream)" {...STROKE} />
      {/* head */}
      <path d="M180 40 V16" fill="none" {...STROKE} />
      <circle cx="180" cy="12" r="10" fill="var(--h-orange)" {...STROKE} />
      <rect x="74" y="96" width="26" height="54" rx="13" fill="var(--h-orange)" {...STROKE} />
      <rect x="260" y="96" width="26" height="54" rx="13" fill="var(--h-orange)" {...STROKE} />
      <rect x="88" y="40" width="184" height="156" rx="58" fill="var(--h-lime)" {...STROKE} />
      <rect x="114" y="78" width="132" height="84" rx="36" fill="var(--h-ink)" />
      <circle cx="152" cy="116" r="19" fill="var(--h-cream)" />
      <circle cx="208" cy="116" r="19" fill="var(--h-cream)" />
      <circle cx="157" cy="118" r="9" fill="var(--h-ink)" />
      <circle cx="213" cy="118" r="9" fill="var(--h-ink)" />
      <circle cx="160" cy="114" r="3" fill="var(--h-cream)" />
      <circle cx="216" cy="114" r="3" fill="var(--h-cream)" />
      <path d="M160 144 Q180 160 200 144" fill="none" stroke="var(--h-lime)" strokeWidth={5} strokeLinecap="round" />
    </svg>
  )
}

const ART = { stroke: 'var(--h-ink)', strokeWidth: 4, strokeLinejoin: 'round', strokeLinecap: 'round' }

function ArtJoin() {
  return (
    <svg viewBox="0 0 240 190" className="h-full w-full" aria-hidden="true">
      <rect x="12" y="14" width="216" height="150" rx="18" fill="var(--h-cream)" {...ART} />
      {[
        [28, 30],
        [124, 30],
        [28, 94],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="88" height="56" rx="12" fill="#e9e2bd" {...ART} strokeWidth={3} />
          <circle cx={x + 44} cy={y + 22} r="9" fill="var(--h-ink)" opacity=".7" />
          <path d={`M${x + 26} ${y + 50} q18 -18 36 0`} fill="var(--h-ink)" opacity=".7" />
        </g>
      ))}
      <rect x="124" y="94" width="88" height="56" rx="12" fill="var(--h-lime)" {...ART} strokeWidth={3} />
      <rect x="150" y="104" width="36" height="28" rx="12" fill="var(--h-ink)" />
      <circle cx="160" cy="118" r="5" fill="var(--h-cream)" />
      <circle cx="176" cy="118" r="5" fill="var(--h-cream)" />
      <circle cx="162" cy="119" r="2.4" fill="var(--h-ink)" />
      <circle cx="178" cy="119" r="2.4" fill="var(--h-ink)" />
    </svg>
  )
}

function ArtRecord() {
  const bars = [30, 62, 44, 90, 70, 110, 58, 84, 36, 66, 48, 28]
  return (
    <svg viewBox="0 0 240 190" className="h-full w-full" aria-hidden="true">
      <rect x="12" y="14" width="216" height="150" rx="18" fill="var(--h-cream)" {...ART} />
      {bars.map((h, i) => (
        <rect key={i} x={30 + i * 15.5} y={90 - h / 2} width="9" height={h} rx="4.5" fill={i === 5 ? 'var(--h-orange)' : 'var(--h-ink)'} />
      ))}
      <path d="M30 128 h110M30 144 h150" fill="none" stroke="var(--h-ink)" strokeWidth="5" strokeLinecap="round" opacity=".35" />
      <circle cx="198" cy="136" r="8" fill="var(--h-orange)" {...ART} strokeWidth={3} />
    </svg>
  )
}

function ArtReview() {
  return (
    <svg viewBox="0 0 240 190" className="h-full w-full" aria-hidden="true">
      {[
        [18, 18, true],
        [18, 64, true],
        [18, 110, false],
      ].map(([x, y, on], i) => (
        <g key={i} transform={`rotate(${i === 1 ? 1.5 : i === 2 ? -1 : 0} 120 ${y + 22})`}>
          <rect x={x} y={y} width="204" height="42" rx="12" fill="var(--h-cream)" {...ART} />
          <rect x={x + 12} y={y + 11} width="20" height="20" rx="6" fill={on ? 'var(--h-ink)' : 'var(--h-cream)'} {...ART} strokeWidth={3} />
          {on && <path d={`M${x + 16} ${y + 21} l5 5 l8 -10`} fill="none" stroke="var(--h-lime)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
          <path d={`M${x + 46} ${y + 17} h${on ? 96 : 70}M${x + 46} ${y + 28} h${on ? 60 : 46}`} fill="none" stroke="var(--h-ink)" strokeWidth="4.5" strokeLinecap="round" opacity={on ? 1 : 0.35} />
          <rect x={x + 158} y={y + 11} width="34" height="20" rx="10" fill={on ? 'var(--h-lime)' : '#e9e2bd'} {...ART} strokeWidth={3} />
        </g>
      ))}
    </svg>
  )
}

// ── Sections ──────────────────────────────────────────────────────────────────

const FIELDS = [
  'Summary',
  'Description',
  'Issue type',
  'Priority',
  'Assignee',
  'Parent epic',
  'Labels',
  'Sprint',
  'Start date',
  'Due date',
]

const STEPS = [
  {
    title: 'Paste the link',
    body: 'Drop in a Google Meet or Zoom URL and pick a name for the bot. It joins the call like any other guest.',
    art: ArtJoin,
  },
  {
    title: 'It listens, you don’t type',
    body: 'MeetMind records and transcribes while you talk. This page shows each stage and how long it has run.',
    art: ArtRecord,
  },
  {
    title: 'Review, then file',
    body: 'Every action item arrives as a draft Jira ticket. Edit it, skip it or approve it. Nothing ships until you say so.',
    art: ArtReview,
  },
]

const SAMPLE_TICKETS = [
  { id: 1, title: 'Move billing webhooks to the retry queue', meta: 'Story · High · Due Nov 4' },
  { id: 2, title: 'Fix timezone offset in the weekly digest', meta: 'Bug · Medium' },
  { id: 3, title: 'Draft the Q4 onboarding experiment plan', meta: 'Task · Low · Due Nov 18' },
]

const FAQ = [
  {
    q: 'Does it push to Jira on its own?',
    a: 'No. MeetMind drafts tickets and waits. You approve each one, and only approved tickets are created.',
  },
  {
    q: 'What if nothing needs a ticket?',
    a: 'You still get the meeting summary. MeetMind skips ticket drafting when the call has no action items.',
  },
  {
    q: 'Which meetings does it join?',
    a: 'Google Meet and Zoom links. Paste the URL and the bot joins under the name you give it.',
  },
  {
    q: 'Can I change a ticket before it is filed?',
    a: 'Yes. Edit the title, description, type, priority, assignee, epic, labels, sprint and dates, or delete the draft.',
  },
]

function DemoReview() {
  const [on, setOn] = useState(() => new Set([1, 3]))
  const toggle = (id) =>
    setOn((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="on-cream rounded-[28px] bg-[var(--h-cream)] p-5 text-[var(--h-ink)] sm:p-7">
      <p className="text-sm font-semibold opacity-70">Sample drafts from a sample meeting</p>
      <ul className="mt-4 space-y-3">
        {SAMPLE_TICKETS.map((t) => {
          const checked = on.has(t.id)
          return (
            <li key={t.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[3px] border-[var(--h-ink)] p-4 transition-[background-color,transform,opacity] duration-150 active:scale-[0.99] ${
                  checked ? 'bg-white' : 'bg-transparent opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(t.id)}
                  className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#0d1a12]"
                />
                <span className="min-w-0">
                  <span className="block font-bold leading-snug">{t.title}</span>
                  <span className="mt-0.5 block text-sm opacity-70">{t.meta}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <p className="mt-5 text-[15px] font-medium" aria-live="polite">
        <span className="tabular-nums font-extrabold">{on.size}</span> of {SAMPLE_TICKETS.length} would be created in Jira
      </p>
    </div>
  )
}

export default function Home({ onStart }) {
  const rootRef = useRef(null)
  useReveal(rootRef)

  return (
    <div ref={rootRef} className="home min-h-screen">
      <a
        href="#top"
        className="sr-only z-50 rounded-full bg-[var(--h-lime)] px-4 py-2 font-bold text-[var(--h-ink)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('top')?.focus()
        }}
      >
        Skip to Content
      </a>

      {/* Nav */}
      <header className="relative z-30 mx-auto w-full max-w-[1240px] px-4 pt-4 sm:px-6">
        <nav
          aria-label="Main"
          className="on-cream flex h-14 items-center justify-between rounded-full bg-[var(--h-cream)] pl-5 pr-2 text-[var(--h-ink)]"
        >
          <a href="#top" className="flex items-center gap-2" aria-label="MeetMind home" translate="no">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <rect x="2" y="9" width="3.5" height="6" rx="1.75" fill="currentColor" />
              <rect x="8" y="4" width="3.5" height="16" rx="1.75" fill="currentColor" />
              <rect x="14" y="7" width="3.5" height="10" rx="1.75" fill="currentColor" />
              <rect x="20" y="10" width="2.5" height="4" rx="1.25" fill="var(--h-orange)" />
            </svg>
            <span className="display text-xl">MeetMind</span>
          </a>
          <div className="flex items-center gap-1 sm:gap-5">
            <a href="#how" className="hidden rounded-full px-2 py-2 text-[15px] font-semibold hover:underline sm:inline">
              How It Works
            </a>
            <a href="#try" className="hidden rounded-full px-2 py-2 text-[15px] font-semibold hover:underline sm:inline">
              Try a Review
            </a>
            <a href="#faq" className="hidden rounded-full px-2 py-2 text-[15px] font-semibold hover:underline md:inline">
              FAQ
            </a>
            <button type="button" onClick={onStart} className="h-btn h-btn-ink !min-h-10 !px-5">
              Start a Meeting
            </button>
          </div>
        </nav>
      </header>

      <main id="top" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="relative mx-auto max-w-[1240px] px-4 pb-0 pt-14 sm:px-6 sm:pt-20">
          <Starburst className="h-spin-slow pointer-events-none absolute left-1/2 top-[-120px] -z-0 w-[1100px] max-w-none -translate-x-1/2" />
          <div className="relative z-10 text-center">
            <h1 className="display mx-auto max-w-[14ch] text-[clamp(3rem,10vw,7.25rem)] uppercase text-[var(--h-lime)] sm:max-w-none">
              Meetings in.
              <br />
              Jira tickets out.
            </h1>
            <p className="mx-auto mt-6 max-w-[44ch] text-[clamp(1.05rem,2vw,1.35rem)] leading-snug text-[var(--h-text)]">
              MeetMind joins your Google Meet or Zoom call, records it, and drafts the tickets and summary. You review, then push to Jira.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={onStart} className="h-btn h-btn-lime w-full sm:w-auto">
                Start a Meeting
              </button>
              <a href="#how" className="h-btn h-btn-ghost w-full sm:w-auto">
                See how it works →
              </a>
            </div>
          </div>

          {/* Join panel with mascot */}
          <div className="relative z-10 mt-56 sm:mt-28">
            <div className="pointer-events-none absolute -top-[160px] right-[2%] z-20 w-[200px] sm:-top-[250px] sm:right-[5%] sm:w-[340px]">
              <div className="h-pop absolute -left-2 top-2 z-10 rotate-[4deg] rounded-2xl bg-[var(--h-ink)] px-3 py-1.5 text-base font-extrabold text-[var(--h-lime)] sm:left-auto sm:-right-12 sm:top-0 sm:px-5 sm:py-2.5 sm:text-2xl">
                <span className="display uppercase tracking-normal">Tickets ready!</span>
              </div>
              <Mascot className="h-bob w-full" />
            </div>

            <div className="on-cream relative overflow-hidden rounded-[32px] bg-[var(--h-cream)] px-6 pb-10 pt-10 text-[var(--h-ink)] sm:rounded-[44px] sm:px-12 sm:pb-12 sm:pt-14">
              <h2 className="display max-w-[8ch] text-[clamp(2.5rem,7vw,5rem)] uppercase">Join calls on:</h2>
              <div className="mt-8 flex flex-wrap gap-3">
                {['Google Meet', 'Zoom'].map((n) => (
                  <span key={n} className="flex h-14 items-center rounded-full border-[3px] border-[var(--h-ink)] bg-white px-7 text-lg font-bold" translate="no">
                    {n}
                  </span>
                ))}
                <span className="flex h-14 items-center rounded-full bg-[var(--h-ink)] px-7 text-lg font-bold text-[var(--h-lime)]" translate="no">
                  Files to Jira
                </span>
              </div>

              <div className="relative -mx-6 mt-10 overflow-hidden sm:-mx-12" aria-label="Jira fields MeetMind fills in">
                <p className="mb-3 px-6 text-sm font-semibold opacity-70 sm:px-12">Every field it drafts:</p>
                <div className="h-marquee flex w-max gap-3 px-6 motion-reduce:w-auto motion-reduce:flex-wrap sm:px-12">
                  {[...FIELDS, ...FIELDS].map((f, i) => (
                    <span
                      key={`${f}-${i}`}
                      aria-hidden={i >= FIELDS.length ? 'true' : undefined}
                      className={`flex h-11 items-center rounded-full border-[3px] border-[var(--h-ink)] bg-white px-5 font-semibold ${
                        i >= FIELDS.length ? 'motion-reduce:hidden' : ''
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 pb-8 pt-28 sm:px-6 sm:pt-40">
          <Reveal as="h2" className="display mx-auto max-w-[16ch] text-center text-[clamp(2.5rem,7vw,5.25rem)] uppercase text-[var(--h-lime)]">
            Three steps. Zero note-taking.
          </Reveal>
          <ul className="mt-14 grid gap-5 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 80} className="flex flex-col overflow-hidden rounded-[32px] bg-[var(--h-deep)]">
                <div className="on-cream m-3 aspect-[240/190] rounded-[24px] bg-[var(--h-lime)] p-4">
                  <s.art />
                </div>
                <div className="px-6 pb-7 pt-3">
                  <h3 className="display text-[1.9rem] text-[var(--h-lime)]">{s.title}</h3>
                  <p className="mt-3 text-[1.02rem] leading-relaxed text-[var(--h-text)]">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Live demo */}
        <section id="try" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 py-24 sm:px-6 sm:py-36">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <Reveal>
              <h2 className="display text-[clamp(2.5rem,6.5vw,4.75rem)] uppercase text-[var(--h-lime)]">You decide what gets filed.</h2>
              <p className="mt-6 max-w-[46ch] text-[1.15rem] leading-relaxed">
                Every draft lands in a review list. Tick the ones that belong in Jira, skip the rest, and open any ticket to change its assignee, epic, labels, sprint or dates.
              </p>
              <button type="button" onClick={onStart} className="h-btn h-btn-lime mt-8">
                Try it on your meeting
              </button>
            </Reveal>
            <Reveal delay={120}>
              <DemoReview />
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <Reveal as="h2" className="display text-[clamp(2.5rem,6.5vw,4.75rem)] uppercase text-[var(--h-lime)]">
              Questions, answered.
            </Reveal>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <Reveal key={item.q} delay={i * 60}>
                  <details className="on-cream group rounded-[24px] bg-[var(--h-cream)] text-[var(--h-ink)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[24px] px-6 py-5 text-lg font-bold [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--h-ink)] text-xl leading-none text-[var(--h-lime)] transition-transform duration-200 group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="px-6 pb-6 text-[1.02rem] leading-relaxed">{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
          <Reveal className="on-lime relative overflow-hidden rounded-[36px] bg-[var(--h-lime)] px-6 py-16 text-center text-[var(--h-ink)] sm:rounded-[48px] sm:py-24">
            <h2 className="display mx-auto max-w-[14ch] text-[clamp(2.75rem,9vw,6.5rem)] uppercase">Send the bot to your next meeting.</h2>
            <button type="button" onClick={onStart} className="h-btn h-btn-ink mt-10 !min-h-14 !px-9 !text-lg">
              Start a Meeting
            </button>
          </Reveal>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 pb-10 pt-4 text-[15px] text-[var(--h-muted)] sm:px-6">
        <span className="display text-2xl text-[var(--h-lime)]" translate="no">
          MeetMind
        </span>
        <p>Meetings in, Jira tickets out.</p>
      </footer>
    </div>
  )
}
