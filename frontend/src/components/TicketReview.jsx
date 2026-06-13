import { useState, useEffect, useRef } from 'react'
import { approveTickets, getJiraMetadata } from '../api/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_DOT = {
  Epic:  'bg-purple-500',
  Story: 'bg-green-500',
  Task:  'bg-blue-500',
  Bug:   'bg-red-500',
}
const TYPE_BADGE = {
  Epic:  'bg-purple-100 text-purple-700',
  Story: 'bg-green-100 text-green-700',
  Task:  'bg-blue-100 text-blue-700',
  Bug:   'bg-red-100 text-red-700',
}
const PRIORITY_ICON = {
  Highest: '🔴', High: '🔴', Medium: '🟡', Low: '🟢', Lowest: '🟢',
}

const META_FALLBACK = {
  assignees:   [],
  priorities:  [{ id: '1', name: 'High' }, { id: '2', name: 'Medium' }, { id: '3', name: 'Low' }],
  issue_types: [{ id: '1', name: 'Bug' }, { id: '2', name: 'Task' }],
  labels:      [],
  epics:       [],
}

const INPUT_CLS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const LABEL_CLS = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner({ cls = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${cls}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ── Labels multi-select ───────────────────────────────────────────────────────

function LabelsField({ selected, suggestions, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = suggestions.filter(
    (l) => l.toLowerCase().includes(search.toLowerCase()) && !selected.includes(l)
  )

  function add(label) {
    if (label && !selected.includes(label)) onChange([...selected, label])
    setSearch('')
    setOpen(false)
  }

  function handleKey(e) { if (e.key === 'Enter' && search.trim()) add(search.trim()) }

  return (
    <div className="relative" ref={ref}>
      <div
        className="min-h-[38px] border border-gray-300 rounded-lg px-2 py-1.5 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-indigo-500 cursor-text"
        onClick={() => setOpen(true)}
      >
        {selected.map((l) => (
          <span key={l} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
            {l}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onChange(selected.filter((x) => x !== l)) }}
              className="hover:text-indigo-900 leading-none"
            >×</button>
          </span>
        ))}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={selected.length === 0 ? 'Add labels…' : ''}
          className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5"
        />
      </div>
      {open && (filtered.length > 0 || search.trim()) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-36 overflow-y-auto">
          {search.trim() && !suggestions.includes(search.trim()) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(search.trim())}
              className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 text-indigo-600"
            >
              + Create &quot;{search.trim()}&quot;
            </button>
          )}
          {filtered.map((l) => (
            <button
              key={l}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(l)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 text-gray-700"
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

function EditPanel({ ticket, meta, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState({
    title:               ticket.title,
    description:         ticket.description,
    ticket_type:         ticket.ticket_type,
    priority:            ticket.priority,
    assignee:            ticket.assignee || '',
    assignee_account_id: ticket.assignee_account_id || null,
    parent_epic:         ticket.parent_epic || '',
    labels:              Array.isArray(ticket.labels) ? ticket.labels : [],
    due_date:            ticket.due_date || '',
    start_date:          ticket.start_date || '',
  })
  const [assigneeSearch, setAssigneeSearch] = useState(ticket.assignee || '')
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const assigneeRef = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setAssigneeOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filteredAssignees = meta.assignees.filter((a) =>
    a.displayName?.toLowerCase().includes(assigneeSearch.toLowerCase())
  )

  function set(key, val) { setDraft((d) => ({ ...d, [key]: val })) }

  return (
    <>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .slide-panel { animation: slideInRight 0.2s ease-out; }
      `}</style>

      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="slide-panel fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <p className="font-semibold text-gray-800 text-sm truncate pr-3">{draft.title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Summary */}
          <div>
            <label className={LABEL_CLS}>Summary</label>
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} className={INPUT_CLS} />
          </div>

          {/* Description */}
          <div>
            <label className={LABEL_CLS}>Description</label>
            <textarea
              rows={5}
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {/* Issue Type */}
          <div>
            <label className={LABEL_CLS}>Issue Type</label>
            <div className="grid grid-cols-2 gap-2">
              {meta.issue_types.map((it) => (
                <button
                  key={it.id}
                  onClick={() => set('ticket_type', it.name)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    draft.ticket_type === it.name
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TYPE_DOT[it.name] || 'bg-gray-400'}`} />
                  {it.name}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className={LABEL_CLS}>Priority</label>
            <div className="flex flex-wrap gap-2">
              {meta.priorities.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set('priority', p.name)}
                  className={`flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    draft.priority === p.name
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {PRIORITY_ICON[p.name] || '⚪'} {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className={LABEL_CLS}>Assignee</label>
            {meta.assignees.length > 0 ? (
              <div className="relative" ref={assigneeRef}>
                <input
                  value={assigneeSearch}
                  onChange={(e) => {
                    setAssigneeSearch(e.target.value)
                    set('assignee', e.target.value)
                    set('assignee_account_id', null)
                    setAssigneeOpen(true)
                  }}
                  onFocus={() => setAssigneeOpen(true)}
                  placeholder="Search by name…"
                  className={INPUT_CLS}
                />
                {assigneeOpen && filteredAssignees.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-44 overflow-y-auto">
                    {filteredAssignees.map((u) => (
                      <button
                        key={u.accountId}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          set('assignee', u.displayName)
                          set('assignee_account_id', u.accountId)
                          setAssigneeSearch(u.displayName)
                          setAssigneeOpen(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-sm text-left"
                      >
                        {u.avatar ? (
                          <img src={u.avatar} className="w-6 h-6 rounded-full shrink-0" alt="" />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                            {u.displayName?.[0] ?? '?'}
                          </span>
                        )}
                        <span className="text-gray-800">{u.displayName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input
                value={draft.assignee}
                onChange={(e) => set('assignee', e.target.value)}
                placeholder="Unassigned"
                className={INPUT_CLS}
              />
            )}
          </div>

          {/* Parent Epic */}
          {meta.epics.length > 0 && (
            <div>
              <label className={LABEL_CLS}>Parent Epic</label>
              <select
                value={draft.parent_epic}
                onChange={(e) => set('parent_epic', e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">None</option>
                {meta.epics.map((ep) => (
                  <option key={ep.key} value={ep.key}>{ep.key}: {ep.summary}</option>
                ))}
              </select>
            </div>
          )}

          {/* Labels */}
          <div>
            <label className={LABEL_CLS}>
              Labels{' '}
              <span className="font-normal normal-case text-gray-400">press Enter to create</span>
            </label>
            <LabelsField
              selected={draft.labels}
              suggestions={meta.labels}
              onChange={(labels) => set('labels', labels)}
            />
          </div>

          {/* Start Date + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Start Date</label>
              <input
                type="date"
                value={draft.start_date}
                onChange={(e) => set('start_date', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Due Date</label>
              <input
                type="date"
                value={draft.due_date}
                onChange={(e) => set('due_date', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 space-y-2">
          <button
            onClick={() => onSave({ ...ticket, ...draft })}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-6 py-2.5 transition-colors text-sm"
          >
            Save Changes
          </button>
          <button
            onClick={() => onDelete(ticket.id)}
            className="w-full text-red-500 hover:text-red-700 text-sm font-medium py-1.5 transition-colors"
          >
            Delete Ticket
          </button>
        </div>
      </div>
    </>
  )
}

// ── Ticket card (list view) ───────────────────────────────────────────────────

function TicketCard({ ticket, onToggle, onOpenEdit }) {
  const dot   = TYPE_DOT[ticket.ticket_type]   || 'bg-gray-400'
  const badge = TYPE_BADGE[ticket.ticket_type] || 'bg-gray-100 text-gray-600'
  const icon  = PRIORITY_ICON[ticket.priority] || '⚪'

  return (
    <div className={`border rounded-xl p-4 transition-all ${
      ticket.approved ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50 opacity-60'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm mb-1.5">{ticket.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              {ticket.ticket_type}
            </span>
            <span className="text-xs text-gray-500">{icon} {ticket.priority}</span>
            {ticket.assignee && ticket.assignee !== 'Unassigned' && (
              <span className="text-xs text-gray-500">👤 {ticket.assignee}</span>
            )}
            {ticket.due_date && (
              <span className="text-xs text-gray-500">📅 {ticket.due_date}</span>
            )}
            {Array.isArray(ticket.labels) && ticket.labels.map((l) => (
              <span key={l} className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{l}</span>
            ))}
          </div>
          <p className="text-xs text-gray-500 line-clamp-2">{ticket.description}</p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={() => onToggle(ticket.id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              ticket.approved
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
            }`}
          >
            {ticket.approved ? '✅ Approved' : '❌ Rejected'}
          </button>
          <button
            onClick={() => onOpenEdit(ticket)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ✏️ Edit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TicketReview({ botId, tickets: initialTickets, onComplete }) {
  const [tickets, setTickets] = useState(
    initialTickets.map((t) => ({ ...t, approved: true }))
  )
  const [jiraMeta, setJiraMeta] = useState(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [editingTicket, setEditingTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const approvedCount = tickets.filter((t) => t.approved).length

  useEffect(() => {
    getJiraMetadata()
      .then((res) => setJiraMeta(res.data))
      .catch(() => setJiraMeta(META_FALLBACK))
      .finally(() => setMetaLoading(false))
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
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
      showToast('Please approve at least one ticket before pushing to Jira.')
      return
    }
    setLoading(true)
    try {
      await approveTickets(
        botId,
        approved.map((t) => t.id),
        approved.map(({ id, title, description, ticket_type, priority, assignee,
                        assignee_account_id, due_date, start_date, labels, parent_epic }) => ({
          id, title, description, ticket_type, priority, assignee,
          assignee_account_id, due_date, start_date, labels, parent_epic,
        }))
      )
      onComplete()
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || 'Failed to push tickets to Jira')
    } finally {
      setLoading(false)
    }
  }

  const meta = jiraMeta || META_FALLBACK

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl max-w-sm text-center">
          {toast}
        </div>
      )}

      {/* Edit panel */}
      {editingTicket && (
        <EditPanel
          ticket={editingTicket}
          meta={meta}
          onSave={saveEdit}
          onDelete={deleteTicket}
          onClose={() => setEditingTicket(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Review Tickets</h2>
          {metaLoading && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Spinner cls="h-3 w-3" /> Loading Jira metadata…
            </p>
          )}
        </div>
        <span className="text-sm text-gray-500">{approvedCount} of {tickets.length} approved</span>
      </div>

      <div className="space-y-3 mb-6">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onToggle={toggle}
            onOpenEdit={setEditingTicket}
          />
        ))}
      </div>

      <div className="space-y-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg px-6 py-3 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <><Spinner /> Pushing to Jira…</> : `Push ${approvedCount} ticket${approvedCount !== 1 ? 's' : ''} to Jira →`}
        </button>

        {approvedCount === 0 && (
          <button
            onClick={onComplete}
            className="w-full border border-gray-300 hover:border-gray-400 text-gray-600 font-semibold rounded-lg px-6 py-3 transition-colors text-sm"
          >
            End without pushing to Jira →
          </button>
        )}
      </div>
    </div>
  )
}
