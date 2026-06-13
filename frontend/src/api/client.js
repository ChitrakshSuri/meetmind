import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

export function startMeeting(meetingUrl, botName) {
  return api.post('/api/v1/meetings/start', { meeting_url: meetingUrl, bot_name: botName })
}

export function getMeetingStatus(botId) {
  return api.get(`/api/v1/meetings/${botId}/status`)
}

export function getTickets(botId) {
  return api.get(`/api/v1/meetings/${botId}/tickets`)
}

export function approveTickets(botId, approvedIds, editedTickets) {
  return api.post(`/api/v1/meetings/${botId}/approve`, {
    approved_ids: approvedIds,
    edited_tickets: editedTickets,
  })
}

export function getSummary(botId) {
  return api.get(`/api/v1/meetings/${botId}/summary`)
}
