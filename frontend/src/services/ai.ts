import api from './api'

export const analyzeCopilot = (payload: object) => api.post('/copilot/analyze', payload)
