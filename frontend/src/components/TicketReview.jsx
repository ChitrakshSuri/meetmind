import { useState } from 'react'
import { approveTickets } from '../api/client'

const PRIORITY_COLORS = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

const PRIORITY_SELECT_COLORS = {
  High: 'text-red-700',
  Medium: 'text-yellow-700',
  Low: 'text-green-700',
}

function TicketCard({ ticket, onToggle, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState({
    title: ticket.title,
    description: ticket.description,
    ticket_type: ticket.ticket_type,
    priority: ticket.priority,
    assignee: ticket.assignee,
  })

  function openEdit() {
    setDraft({
      title: ticket.title,
      description: ticket.description,
      ticket_type: ticket.ticket_type,
      priority: ticket.priority,
      assignee: ticket.assignee,
    })
    setEditing(true)
  }

  function handleSave() {
    onEdit({ ...ticket, ...draft })
    setEditing(false)
  }

  function handleCancel() {
    setEditing(false)
  }

  const cardBorder = editing
    ? 'border-blue-400 bg-blue-50'
    : ticket.approved
    ? 'border-indigo-300 bg-indigo-50'
    : 'border-gray-200 bg-gray-50 opacity-60'

  return (
    <div className={`border rounded-xl p-4 transition-all ${cardBorder}`}>
      {/* Approve toggle — always visible */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <p className="font-semibold text-gray-800 text-sm">{ticket.title}</p>
          )}
        </div>
        <button
          onClick={() => onToggle(ticket.id)}
          className={`shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
            ticket.approved
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
          }`}
        >
          {ticket.approved ? '✅ Approved' : '❌ Rejected'}
        </button>
      </div>

      {editing ? (
        /* ── Edit mode ─────────────────────────────────────────────── */
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-0.5">Description</label>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-0.5">Type</label>
              <select
                value={draft.ticket_type}
                onChange={(e) => setDraft((d) => ({ ...d, ticket_type: e.target.value }))}
                className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="Bug">Bug</option>
                <option value="Task">Task</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-0.5">Priority</label>
              <select
                value={draft.priority}
                onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
                className={`w-full border border-blue-300 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 ${PRIORITY_SELECT_COLORS[draft.priority] || ''}`}
              >
                <option value="High" className="text-red-700">High</option>
                <option value="Medium" className="text-yellow-700">Medium</option>
                <option value="Low" className="text-green-700">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-0.5">Assignee</label>
            <input
              value={draft.assignee}
              onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
              placeholder="Unassigned"
              className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg py-1.5 transition-colors"
            >
              ✅ Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg py-1.5 transition-colors"
            >
              ✗ Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ── View mode ─────────────────────────────────────────────── */
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {ticket.ticket_type}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-600'
              }`}
            >
              {ticket.priority}
            </span>
          </div>

          <div className="mb-2">
            <p className={`text-xs text-gray-600 ${expanded ? '' : 'line-clamp-2'}`}>
              {ticket.description}
            </p>
            {ticket.description && ticket.description.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-indigo-600 hover:underline mt-0.5"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              👤 {ticket.assignee || 'Unassigned'}
            </span>
            <button
              onClick={openEdit}
              className="text-xs text-gray-400 hover:text-indigo-600 font-medium transition-colors"
            >
              ✏️ Edit
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function TicketReview({ botId, tickets: initialTickets, onComplete }) {
  const [tickets, setTickets] = useState(
    initialTickets.map((t) => ({ ...t, approved: true }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const approvedCount = tickets.filter((t) => t.approved).length

  function toggle(id) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, approved: !t.approved } : t)))
  }

  function editTicket(updated) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  async function handleSubmit() {
    const approved = tickets.filter((t) => t.approved)
    if (!approved.length) return
    setLoading(true)
    setError(null)
    try {
      await approveTickets(
        botId,
        approved.map((t) => t.id),
        approved.map(({ id, title, description, ticket_type, priority, assignee }) => ({
          id,
          title,
          description,
          ticket_type,
          priority,
          assignee,
        }))
      )
      onComplete()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to push tickets to Jira')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Review Tickets</h2>
        <span className="text-sm text-gray-500">
          {approvedCount} of {tickets.length} approved
        </span>
      </div>

      <div className="space-y-3 mb-6">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} onToggle={toggle} onEdit={editTicket} />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || approvedCount === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg px-6 py-3 flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <>
            <Spinner /> Pushing to Jira...
          </>
        ) : (
          `Push ${approvedCount} ticket${approvedCount !== 1 ? 's' : ''} to Jira →`
        )}
      </button>
    </div>
  )
}
