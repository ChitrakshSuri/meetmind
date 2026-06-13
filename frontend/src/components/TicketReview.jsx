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

function TicketCard({ ticket, onToggle, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingAssignee, setEditingAssignee] = useState(false)
  const [titleVal, setTitleVal] = useState(ticket.title)
  const [assigneeVal, setAssigneeVal] = useState(ticket.assignee)

  function saveTitle() {
    setEditingTitle(false)
    onEdit({ ...ticket, title: titleVal })
  }

  function saveAssignee() {
    setEditingAssignee(false)
    onEdit({ ...ticket, assignee: assigneeVal })
  }

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        ticket.approved ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
              className="w-full border border-indigo-300 rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          ) : (
            <div className="flex items-center gap-1.5 group">
              <p className="font-semibold text-gray-800 text-sm">{titleVal}</p>
              <button
                onClick={() => setEditingTitle(true)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity text-xs shrink-0"
                title="Edit title"
              >
                ✏️
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mt-1.5">
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

      <div className="mt-2">
        <p className={`text-xs text-gray-600 ${expanded ? '' : 'line-clamp-2'}`}>{ticket.description}</p>
        {ticket.description && ticket.description.length > 120 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-600 hover:underline mt-0.5"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
        <span>👤</span>
        {editingAssignee ? (
          <input
            autoFocus
            value={assigneeVal}
            onChange={(e) => setAssigneeVal(e.target.value)}
            onBlur={saveAssignee}
            onKeyDown={(e) => e.key === 'Enter' && saveAssignee()}
            className="border border-indigo-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        ) : (
          <button
            onClick={() => setEditingAssignee(true)}
            className="hover:text-indigo-600 hover:underline"
          >
            {assigneeVal || 'Unassigned'}
          </button>
        )}
      </div>
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
