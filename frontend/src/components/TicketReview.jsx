import { useState, useEffect, useRef, useId } from 'react'
import { approveTickets, getJiraMetadata } from '../api/client'
import { Spinner, CloseIcon, ArrowIcon } from './ui'

// ── Constants ─────────────────────────────────────────────────────────────────

// Type and priority are categories, so they get a small dot, never a filled badge.
const TYPE_DOT = {
  Epic: '#0f8b8d',
  Story: '#2e8b57',
  Task: '#1d5fbf',
  Bug: '#c4242a',
}
const PRIORITY_DOT = {
  Highest: '#c4242a',
  High: '#c4242a',
  Medium: '#b7791f',
  Low: '#8a8f98',
  Lowest: '#8a8f98',
}

const META_FALLBACK = {
  assignees: [],
  priorities: [],
  issue_types: [],
  labels: [],
  epics: [],
  statuses: [],
  sprints: [],
  board_id: null,
  project_key: '',
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
function formatDate(value) {
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? value : dateFmt.format(d)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Dot({ color }) {
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color || '#8a8f98' }} aria-hidden="true" />
}

// ── Labels multi-select ───────────────────────────────────────────────────────

function LabelsField({ id, selected, suggestions, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = suggestions.filter((l) => l.toLowerCase().includes(search.toLowerCase()) && !selected.includes(l))

  function add(label) {
    if (label && !selected.includes(label)) onChange([...selected, label])
    setSearch('')
    setOpen(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (search.trim()) add(search.trim())
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex min-h-9 cursor-text flex-wrap items-center gap-1.5 rounded-control border border-control bg-surface px-2 py-1 focus-within:border-signal focus-within:shadow-[0_0_0_3px_rgba(29,95,191,0.18)]"
        onClick={() => setOpen(true)}
      >
        {selected.map((l) => (
          <span key={l} className="chip gap-1 pr-0.5">
            {l}
            <button
              type="button"
              aria-label={`Remove label ${l}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation()
                onChange(selected.filter((x) => x !== l))
              }}
              className="flex h-4 w-4 items-center justify-center rounded-[3px] text-muted hover:bg-control/60 hover:text-ink"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          name="labels"
          autoComplete="off"
          spellCheck={false}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={selected.length === 0 ? 'Add labels…' : ''}
          className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted"
        />
      </div>
      {open && (filtered.length > 0 || search.trim()) && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-control bg-surface py-1 shadow-float">
          {search.trim() && !suggestions.includes(search.trim()) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(search.trim())}
              className="w-full px-3 py-2 text-left text-sm font-medium text-signal hover:bg-raised"
            >
              Create “{search.trim()}”
            </button>
          )}
          {filtered.map((l) => (
            <button
              key={l}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(l)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-raised"
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edit panel ────────────────────────────────────────────────────────────────

function OptionButton({ selected, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-9 items-center justify-center gap-2 rounded-control border px-3 py-1.5 text-sm font-medium transition-[border-color,background-color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 ${
        selected ? 'border-ink bg-surface shadow-[inset_0_0_0_1px_var(--text)]' : 'border-control bg-surface text-ink hover:bg-raised'
      }`}
    >
      {children}
    </button>
  )
}

function EditPanel({ ticket, meta, onSave, onDelete, onClose }) {
  const uid = useId()
  const [draft, setDraft] = useState({
    title: ticket.title,
    description: ticket.description,
    ticket_type: ticket.ticket_type,
    priority: ticket.priority,
    assignee: ticket.assignee || '',
    assignee_account_id: ticket.assignee_account_id || null,
    parent_epic: ticket.parent_epic || '',
    labels: Array.isArray(ticket.labels) ? ticket.labels : [],
    due_date: ticket.due_date || '',
    start_date: ticket.start_date || '',
    sprint_id: ticket.sprint_id || null,
  })
  const [assigneeSearch, setAssigneeSearch] = useState(draft.assignee || '')
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.assignee-dropdown-container')) setShowAssigneeDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Escape closes; focus moves into the panel and returns to where it came from.
  useEffect(() => {
    const previous = document.activeElement
    panelRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [onClose])

  function set(key, val) {
    setDraft((d) => ({ ...d, [key]: val }))
  }

  const selectedType = meta.issue_types.find((it) => it.name === draft.ticket_type)
  const isEpicLevel = selectedType ? (selectedType.hierarchyLevel ?? 0) >= 1 : false
  const filteredAssignees = meta.assignees.filter((a) => a.displayName.toLowerCase().includes(assigneeSearch.toLowerCase()))

  return (
    <>
      <div className="fade-in fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        tabIndex={-1}
        className="drawer-in fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-surface shadow-float outline-none sm:w-[440px]"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 id={`${uid}-title`} className="min-w-0 truncate text-[15px] font-semibold">
            Edit Ticket
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost h-8 w-8 px-0">
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5" style={{ overscrollBehavior: 'contain' }}>
          <div>
            <label htmlFor={`${uid}-summary`} className="field-label">
              Summary
            </label>
            <input
              id={`${uid}-summary`}
              name="summary"
              autoComplete="off"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              className="field"
            />
          </div>

          <div>
            <label htmlFor={`${uid}-description`} className="field-label">
              Description
            </label>
            <textarea
              id={`${uid}-description`}
              name="description"
              rows={5}
              autoComplete="off"
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              className="field resize-none"
            />
          </div>

          <fieldset>
            <legend className="field-label">Issue Type</legend>
            {meta.issue_types.length === 0 ? (
              <p className="text-[13px] text-muted">None available</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {meta.issue_types.map((it) => (
                  <OptionButton key={it.id} selected={draft.ticket_type === it.name} onClick={() => set('ticket_type', it.name)}>
                    <Dot color={TYPE_DOT[it.name]} />
                    {it.name}
                  </OptionButton>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="field-label">Priority</legend>
            {meta.priorities.length === 0 ? (
              <p className="text-[13px] text-muted">None available</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {meta.priorities.map((p) => (
                  <div key={p.id} className="min-w-[84px] flex-1 [&>button]:w-full">
                    <OptionButton selected={draft.priority === p.name} onClick={() => set('priority', p.name)}>
                      <Dot color={PRIORITY_DOT[p.name]} />
                      {p.name}
                    </OptionButton>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          <div className="assignee-dropdown-container relative">
            <label htmlFor={`${uid}-assignee`} className="field-label">
              Assignee
            </label>
            <input
              id={`${uid}-assignee`}
              name="assignee"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search assignee…"
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              onFocus={() => setShowAssigneeDropdown(true)}
              className="field"
            />
            {showAssigneeDropdown && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-control bg-surface py-1 shadow-float">
                <button
                  type="button"
                  onClick={() => {
                    set('assignee', 'Unassigned')
                    set('assignee_account_id', null)
                    setAssigneeSearch('')
                    setShowAssigneeDropdown(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-raised"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised text-xs text-muted" aria-hidden="true">
                    –
                  </span>
                  <span className="text-muted">Unassigned</span>
                </button>
                {filteredAssignees.map((a) => (
                  <button
                    key={a.accountId}
                    type="button"
                    onClick={() => {
                      set('assignee', a.displayName)
                      set('assignee_account_id', a.accountId)
                      setAssigneeSearch(a.displayName)
                      setShowAssigneeDropdown(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-raised"
                  >
                    <img
                      src={a.avatar}
                      alt=""
                      width="24"
                      height="24"
                      loading="lazy"
                      className="h-6 w-6 shrink-0 rounded-full bg-raised"
                      onError={(e) => {
                        e.target.style.visibility = 'hidden'
                      }}
                    />
                    <span className="min-w-0 truncate">{a.displayName}</span>
                  </button>
                ))}
                {filteredAssignees.length === 0 && <p className="px-3 py-2 text-[13px] text-muted">No assignees found</p>}
              </div>
            )}
          </div>

          {meta.epics.length > 0 && !isEpicLevel && (
            <div>
              <label htmlFor={`${uid}-epic`} className="field-label">
                Parent Epic
              </label>
              <select
                id={`${uid}-epic`}
                name="parent_epic"
                value={draft.parent_epic}
                onChange={(e) => set('parent_epic', e.target.value)}
                className="field bg-surface text-ink"
              >
                <option value="">None</option>
                {meta.epics.map((ep) => (
                  <option key={ep.key} value={ep.key}>
                    {ep.key}: {ep.summary}
                    {ep.status ? ` (${ep.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor={`${uid}-labels`} className="field-label">
              Labels <span className="font-normal text-muted">Press Enter to create</span>
            </label>
            <LabelsField
              id={`${uid}-labels`}
              selected={draft.labels}
              suggestions={meta.labels}
              onChange={(labels) => set('labels', labels)}
            />
          </div>

          {meta.sprints.length > 0 && (
            <div>
              <label htmlFor={`${uid}-sprint`} className="field-label">
                Sprint
              </label>
              <select
                id={`${uid}-sprint`}
                name="sprint"
                value={draft.sprint_id ?? ''}
                onChange={(e) => set('sprint_id', e.target.value ? Number(e.target.value) : null)}
                className="field bg-surface text-ink"
              >
                <option value="">No Sprint</option>
                {meta.sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.state === 'active' ? '▶ ' : ''}
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-start`} className="field-label">
                Start Date
              </label>
              <input
                id={`${uid}-start`}
                name="start_date"
                type="date"
                value={draft.start_date}
                onChange={(e) => set('start_date', e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label htmlFor={`${uid}-due`} className="field-label">
                Due Date
              </label>
              <input
                id={`${uid}-due`}
                name="due_date"
                type="date"
                value={draft.due_date}
                onChange={(e) => set('due_date', e.target.value)}
                className="field"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {confirmingDelete ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px]">Delete this ticket draft?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmingDelete(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="button" onClick={() => onDelete(ticket.id)} className="btn bg-negative text-white">
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setConfirmingDelete(true)} className="btn btn-danger">
                Delete Ticket
              </button>
              <button type="button" onClick={() => onSave({ ...ticket, ...draft })} className="btn btn-primary">
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Ticket row (list view) ────────────────────────────────────────────────────

function TicketRow({ ticket, onToggle, onOpenEdit }) {
  const checkId = useId()
  const hasAssignee = ticket.assignee && ticket.assignee !== 'Unassigned'
  const labels = Array.isArray(ticket.labels) ? ticket.labels : []

  return (
    <li className="flex items-start gap-3 px-4 py-4 sm:px-5">
      <input
        id={checkId}
        type="checkbox"
        checked={ticket.approved}
        onChange={() => onToggle(ticket.id)}
        aria-label={`Include “${ticket.title}” in Jira push`}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[4px] border-control accent-[#141414]"
      />

      <div className="min-w-0 flex-1">
        <label htmlFor={checkId} className={`block cursor-pointer break-words text-[15px] font-medium leading-snug ${ticket.approved ? '' : 'text-muted'}`}>
          {ticket.title}
        </label>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Dot color={TYPE_DOT[ticket.ticket_type]} />
            {ticket.ticket_type}
          </span>
          {ticket.priority && (
            <span className="inline-flex items-center gap-1.5">
              <Dot color={PRIORITY_DOT[ticket.priority]} />
              {ticket.priority}
            </span>
          )}
          {hasAssignee && <span className="min-w-0 truncate">{ticket.assignee}</span>}
          {ticket.due_date && <span className="num">Due {formatDate(ticket.due_date)}</span>}
          {labels.map((l) => (
            <span key={l} className="chip">
              {l}
            </span>
          ))}
        </div>

        {ticket.description && <p className="mt-2 line-clamp-2 break-words text-[13px] text-muted">{ticket.description}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <button type="button" onClick={() => onOpenEdit(ticket)} className="btn btn-ghost h-8" aria-label={`Edit “${ticket.title}”`}>
          Edit
        </button>
        {!ticket.approved && <span className="chip">Skipped</span>}
      </div>
    </li>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TicketReview({ botId, tickets: initialTickets, onComplete }) {
  const [tickets, setTickets] = useState(initialTickets.map((t) => ({ ...t, approved: true })))
  const [jiraMeta, setJiraMeta] = useState(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [editingTicket, setEditingTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const approvedCount = tickets.filter((t) => t.approved).length

  useEffect(() => {
    getJiraMetadata()
      .then((res) => setJiraMeta(res.data))
      .catch(() => setJiraMeta(META_FALLBACK))
      .finally(() => setMetaLoading(false))
    return () => clearTimeout(toastTimer.current)
  }, [])

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  function toggle(id) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, approved: !t.approved } : t)))
  }

  function saveEdit(updated) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setEditingTicket(null)
  }

  function deleteTicket(id) {
    setTickets((prev) => prev.filter((t) => t.id !== id))
    setEditingTicket(null)
  }

  async function handleSubmit() {
    const approved = tickets.filter((t) => t.approved)
    if (!approved.length) {
      showToast('Approve at least one ticket before pushing to Jira.')
      return
    }
    setLoading(true)
    try {
      await approveTickets(
        botId,
        approved.map((t) => t.id),
        approved.map(
          ({ id, title, description, ticket_type, priority, assignee, assignee_account_id, due_date, start_date, labels, parent_epic, sprint_id }) => ({
            id, title, description, ticket_type, priority, assignee,
            assignee_account_id, due_date, start_date, labels, parent_epic, sprint_id,
          })
        )
      )
      onComplete(true, approved.length)
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || 'Failed to push tickets to Jira')
    } finally {
      setLoading(false)
    }
  }

  const meta = jiraMeta || META_FALLBACK

  return (
    <div>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="toast-in fixed left-1/2 top-4 z-[60] max-w-sm rounded-control bg-primary px-4 py-3 text-center text-sm text-white shadow-float"
        >
          {toast}
        </div>
      )}

      {editingTicket && (
        <EditPanel ticket={editingTicket} meta={meta} onSave={saveEdit} onDelete={deleteTicket} onClose={() => setEditingTicket(null)} />
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Review Tickets</h1>
          <p className="mt-1 max-w-[60ch] text-[15px] text-muted">
            Approve the drafts you want in Jira. Nothing is pushed until you confirm.
          </p>
        </div>
        <p className="text-[13px] text-muted">
          <span className="num text-[22px] font-medium tracking-[-0.01em] text-signal">{approvedCount}</span>
          <span className="num"> of {tickets.length}</span> approved
        </p>
      </div>

      {metaLoading && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted" role="status">
          <Spinner className="h-3 w-3" /> Loading Jira metadata…
        </p>
      )}

      {tickets.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-control px-6 py-10 text-center text-muted">
          All ticket drafts were deleted. You can end the session without pushing anything.
        </div>
      ) : (
        <ul className="panel mt-6 divide-y divide-rule overflow-hidden">
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} onToggle={toggle} onOpenEdit={setEditingTicket} />
          ))}
        </ul>
      )}

      <div className="sticky bottom-0 mt-6 border-t border-line bg-ground py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <p className="num text-[13px] text-muted">
            {approvedCount === 0
              ? 'No tickets approved'
              : `${approvedCount} ${approvedCount === 1 ? 'ticket' : 'tickets'} will be created in Jira`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {approvedCount === 0 && (
              <button type="button" onClick={() => onComplete(false)} className="btn btn-secondary">
                End Without Pushing
              </button>
            )}
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn btn-primary">
              {loading ? (
                <>
                  <Spinner /> Pushing to Jira…
                </>
              ) : (
                <>
                  Push {approvedCount} {approvedCount === 1 ? 'Ticket' : 'Tickets'} to Jira
                  <ArrowIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
