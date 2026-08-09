import { useEffect, useState } from 'react'
import axios from 'axios'

interface InvestigatorApplication {
  id: number
  name: string
  email: string
  role: string
  status: string
  badge_id?: string | null
  created_at?: string | null
}

export default function InvestigatorApprovals() {
  const [applications, setApplications] = useState<InvestigatorApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const loadApplications = async () => {
    setLoading(true)
    setMessage('')
    try {
      const response = await axios.get<InvestigatorApplication[]>('/api/auth/pending')
      setApplications(response.data.filter(user => user.role === 'investigator'))
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Could not load investigator applications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadApplications() }, [])

  const reviewApplication = async (id: number, decision: 'approve' | 'reject') => {
    setWorkingId(id)
    setMessage('')
    try {
      await axios.put(`/api/auth/users/${id}/${decision}`)
      setApplications(current => current.filter(application => application.id !== id))
      setMessage(decision === 'approve' ? 'Investigator approved successfully.' : 'Investigator application rejected.')
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Unable to update this application.')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
        <div>
          <p className="text-sm font-bold text-purple-400 uppercase tracking-widest">Admin review</p>
          <h1 className="text-3xl font-bold text-white mt-1">🕵️ Investigator Approvals</h1>
          <p className="text-gray-400 mt-1">Review and approve verified investigator access requests.</p>
        </div>
        <div className="bg-purple-500/15 border border-purple-500/30 rounded-xl px-5 py-3 text-center">
          <p className="text-2xl font-bold text-purple-300">{applications.length}</p>
          <p className="text-xs font-semibold text-purple-200 uppercase tracking-wide">Awaiting review</p>
        </div>
      </div>

      {message && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
          message.includes('successfully')
            ? 'bg-green-500/10 border-green-500/30 text-green-300'
            : message.includes('rejected')
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map(item => <div key={item} className="h-36 animate-pulse rounded-2xl bg-gray-800 border border-gray-700" />)}
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-green-500/25 bg-green-500/10 px-6 py-14 text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-bold text-green-300">No pending investigator applications</h2>
          <p className="text-gray-400 mt-2">New investigator registrations will appear here for review.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {applications.map(application => (
            <article key={application.id} className="rounded-2xl bg-gray-800 border border-purple-500/25 p-5 shadow-lg shadow-black/10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl">🕵️</div>
                  <div>
                    <h2 className="font-bold text-lg text-white">{application.name}</h2>
                    <p className="text-gray-400">{application.email}</p>
                    <div className="flex flex-wrap gap-2 mt-3 text-xs font-bold">
                      <span className="rounded-md bg-purple-500/15 text-purple-200 px-2.5 py-1">INVESTIGATOR</span>
                      <span className="rounded-md bg-gray-700 text-gray-200 px-2.5 py-1 font-mono">Badge: {application.badge_id || 'Not provided'}</span>
                      {application.created_at && <span className="rounded-md bg-gray-700 text-gray-300 px-2.5 py-1">Applied {new Date(application.created_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 md:shrink-0">
                  <button
                    type="button"
                    disabled={workingId === application.id}
                    onClick={() => void reviewApplication(application.id, 'reject')}
                    className="px-4 py-2.5 rounded-xl border border-red-500/40 text-red-300 font-bold hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {workingId === application.id ? 'Saving…' : 'Reject'}
                  </button>
                  <button
                    type="button"
                    disabled={workingId === application.id}
                    onClick={() => void reviewApplication(application.id, 'approve')}
                    className="px-4 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 disabled:opacity-50 shadow-lg shadow-green-900/30"
                  >
                    Approve access
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
