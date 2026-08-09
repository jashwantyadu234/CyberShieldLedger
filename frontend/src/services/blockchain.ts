import api from './api'

export const verifyComplaint = (complaintId: number) => api.get(`/complaints/${complaintId}/verify`)
