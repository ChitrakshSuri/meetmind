import { useState, useEffect, useRef } from 'react'
import { approveTickets, getAssignees } from '../api/client'

const TYPE_CONFIG = {
  Epic:  { badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  Story: { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500'  },
  Task:  { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'   },
  Bug:   { badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500'    },
}

const PRIORITY_CONFIG = {
  High:   { icon: '🔴', label: 'High'   },
  Medium: { icon: '🟡', label: 'Medium' },
  Low:    { icon: '🟢', label: 'Low'    },
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ── Edit side panel ───────────────────────────────────────────────────────────

function EditPanel({ ticket, assignees, onSave, onClose }) {
  const [draft, setDraft] = useState({
    title:       ticket.title,
    description: ticket.description,
    ticket_type: ticket.ticket_type,
    priority:    ticket.priority,
    assignee:    ticket.assignee || '',
    due_date:    ticket.due_date || '',
    labels:      Array.isArray(ticket.labels)
                   ? ticket.labels.join(', ')
                   : (ticket.labels || ''),
  })
  const [assigneeSearch, setAssigneeSearch] = useState(ticket.assignee || '')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const filteredAssignees = assignees.filter((a) =>
    a.displayName?.toLowerCase().includes(assigneeSearch.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSave() {
    onSave({
      ...ticket,
      ...draft,
      labels: draft.labels
        ? draft.labels.split(',').map((l) => l.trim()).filter(Boolean)
        : [],
    })
  }

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0);    }
        }
        .slide-in-right { animation: slideInRight 0.2s ease-out; }
      `}</style>

      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="slide-in-right fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <p className="font-semibold text-gray-800 text-sm truncate pr-3">{ticket.title}</p>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Title
            </label>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                <button
                  key={type}
                  onClick={() => setDraft((d) => ({ ...d, ticket_type: type }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    draft.ticket_type === type
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {Object.entries(PRIORITY_CONFIG).map(([priority, cfg]) => (
                <button
                  key={priority}
                  onClick={() => setDraft((d) => ({ ...d, priority }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    draft.priority === priority
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Assignee
            </label>
            {assignees.length > 0 ? (
              <div className="relative" ref={dropdownRef}>
                <input
                  value={assigneeSearch}
                  onChange={(e) => {
                    setAssigneeSearch(e.target.value)
                    setDraft((d) => ({ ...d, assignee: e.target.value }))
                    setDropdownOpen(true)
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Search by name..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {dropdownOpen && filteredAssignees.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-44 overflow-y-auto">
                    {filteredAssignees.map((user) => (
                      <button
                        key={user.accountId}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setDraft((d) => ({ ...d, assignee: user.displayName }))
                          setAssigneeSearch(user.displayName)
                          setDropdownOpen(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-sm text-left"
                      >
                        {user.avatarUrls?.['24x24'] ? (
                          <img
                            src={user.avatarUrls['24x24']}
                            className="w-6 h-6 rounded-full shrink-0"
                            alt=""
                          />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                            {user.displayName?.[0] ?? '?'}
                          </span>
                        )}
                        <span className="text-gray-800">{user.displayName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input
                value={draft.assignee}
                onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                placeholder="Unassigned"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={draft.due_date}
              onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Labels */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Labels{' '}
              <span className="font-normal normal-case text-gray-400">comma separated</span>
            </label>
            <input
              value={draft.labels}
              onChange={(e) => setDraft((d) => ({ ...d, labels: e.target.value }))}
              placeholder="frontend, urgent, needs-review"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0">
          <button
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-6 py-2.5 transition-colors text-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </>
  )
}

// ── Ticket card (list view) ───────────────────────────────────────────────────

function TicketCard({ ticket, onToggle, onOpenEdit }) {
  const typeCfg = TYPE_CONFIG[ticket.ticket_type] || TYPE_CONFIG.Task
  const priCfg  = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.Medium

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        ticket.approved
          ? 'border-indigo-300 bg-indigo-50'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm mb-1.5">{ticket.title}</p>

          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${typeCfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${typeCfg.dot}`} />
              {ticket.ticket_type}
            </span>
            <span className="text-xs text-gray-500">{priCfg.icon} {ticket.priority}</span>
            {ticket.assignee && ticket.assignee !== 'Unassigned' && (
              <span className="text-xs text-gray-500">👤 {ticket.assignee}</span>
            )}
            {ticket.due_date && (
              <span className="text-xs text-gray-500">📅 {ticket.due_date}</span>
            )}
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
  const [editingTicket, setEditingTicket] = useState(null)
  const [assignees, setAssignees] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const approvedCount = tickets.filter((t) => t.approved).length

  useEffect(() => {
    getAssignees()
      .then((res) => setAssignees(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAssignees([]))
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

  async function handleSubmit() {
    const approved = tickets.filter((t) => t.approved)
    if (!approved.length) {
      showToast('No tickets approved — approve at least one or click "End without Jira" below.')
      return
    }
    setLoading(true)
    try {
      await approveTickets(
        botId,
        approved.map((t) => t.id),
        approved.map(({ id, title, description, ticket_type, priority, assignee, due_date, labels }) => ({
          id, title, description, ticket_type, priority, assignee, due_date, labels,
        }))
      )
      onComplete()
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || 'Failed to push tickets to Jira')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl max-w-sm text-center">
          {toast}
        </div>
      )}

      {/* Side panel */}
      {editingTicket && (
        <EditPanel
          ticket={editingTicket}
          assignees={assignees}
          onSave={saveEdit}
          onClose={() => setEditingTicket(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Review Tickets</h2>
        <span className="text-sm text-gray-500">
          {approvedCount} of {tickets.length} approved
        </span>
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
          {loading ? (
            <><Spinner /> Pushing to Jira...</>
          ) : (
            `Push ${approvedCount} ticket${approvedCount !== 1 ? 's' : ''} to Jira →`
          )}
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
