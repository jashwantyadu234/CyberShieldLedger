import { useEffect, useState } from 'react'
import axios from 'axios'

export default function InvestigatorManagement() {
  const [investigators, setInvestigators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/auth/users')
      setInvestigators((res.data || []).filter((u: any) => u.role === 'investigator'))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const approve = async (id: number) => {
    await axios.put(`/api/auth/users/${id}/approve`)
    setMessage('✅ Approved!')
    fetchData()
    setTimeout(() => setMessage(''), 3000)
  }

  const reject = async (id: number) => {
    await axios.put(`/api/auth/users/${id}/reject`)
    setMessage('❌ Rejected')
    fetchData()
    setTimeout(() => setMessage(''), 3000)
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-96">
      <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full" />
    </div>
  )

  const approved = investigators.filter(i => i.status === 'approved').length
  const pending = investigators.filter(i => i.status === 'pending').length
  const rejected = investigators.filter(i => i.status === 'rejected').length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-purple-600">🕵️ Investigator Management</h1>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold">
          {investigators.length} total
        </span>
      </div>

      {message && (
        <div className={`p-3 rounded-xl mb-4 font-bold ${
          message.includes('✅') ? 'bg-green-100 text-green-800 border border-green-300'
          : 'bg-red-100 text-red-800 border border-red-300'
        }`}>{message}</div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-purple-600">{investigators.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-600">Approved</p>
          <p className="text-2xl font-bold text-green-600">{approved}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{pending}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-600">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{rejected}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-bold text-gray-800">All Investigators</h2>
        </div>
        <div className="divide-y">
          {investigators.map(inv => (
            <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-xl">
                  🕵️
                </div>
                <div>
                  <p className="font-bold text-gray-800">{inv.name}</p>
                  <p className="text-sm text-gray-600">{inv.email}</p>
                  {inv.badge_id && (
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-500">
                      {inv.badge_id}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                  inv.status === 'approved' ? 'bg-green-100 text-green-700'
                  : inv.status === 'pending' ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
                }`}>{inv.status}</span>
                {inv.status === 'pending' && (
                  <>
                    <button onClick={() => approve(inv.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700">
                      ✅ Approve
                    </button>
                    <button onClick={() => reject(inv.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700">
                      ❌ Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {investigators.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No investigators registered yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
