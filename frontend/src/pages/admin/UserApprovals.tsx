import { useEffect, useState } from 'react'
import axios from 'axios'

export default function UserApprovals() {
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [pendingRes, allRes] = await Promise.all([
        axios.get('/api/auth/pending'),
        axios.get('/api/auth/users'),
      ])
      setPendingUsers(pendingRes.data || [])
      setAllUsers(allRes.data || [])
    } catch (e) {
      console.error('Failed to load users')
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const approve = async (id: number) => {
    await axios.put(`/api/auth/users/${id}/approve`)
    setMessage('✅ User approved!')
    fetchData()
    setTimeout(() => setMessage(''), 3000)
  }

  const reject = async (id: number) => {
    await axios.put(`/api/auth/users/${id}/reject`)
    setMessage('❌ User rejected')
    fetchData()
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-amber-600">✅ User Approvals</h1>
        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm font-bold">
          {pendingUsers.length} pending
        </span>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-4 font-bold ${
          message.includes('✅') ? 'bg-green-100 text-green-800 border border-green-300' : 
          'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : (
        <>
          {pendingUsers.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-amber-600">⏳ Pending Approval ({pendingUsers.length})</h2>
              <div className="space-y-4">
                {pendingUsers.map(user => (
                  <div key={user.id} className="bg-white rounded-xl border-2 border-amber-300 p-5 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl border-2 border-amber-200">
                        {user.role === 'investigator' ? '🕵️' : '👤'}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-800">{user.name}</p>
                        <p className="text-gray-600">{user.email}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="px-3 py-0.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold">
                            {user.role}
                          </span>
                          {user.badge_id && (
                            <span className="px-3 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-mono font-bold">
                              {user.badge_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => approve(user.id)}
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-md">
                        ✅ Approve
                      </button>
                      <button onClick={() => reject(user.id)}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-md">
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingUsers.length === 0 && (
            <div className="bg-white rounded-xl border-2 border-green-200 p-8 text-center mb-8">
              <span className="text-5xl block mb-3">✅</span>
              <h2 className="text-xl font-bold text-green-700 mb-1">No Pending Approvals</h2>
              <p className="text-gray-600">All users have been reviewed.</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">📋 All Users ({allUsers.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {allUsers.map(user => (
                <div key={user.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {user.role === 'admin' ? '⚙️' : user.role === 'investigator' ? '🕵️' : '👤'}
                    </span>
                    <div>
                      <p className="font-bold text-gray-800">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                      user.role === 'admin' ? 'bg-red-100 text-red-700' :
                      user.role === 'investigator' ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'
                    }`}>
                      {user.role}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                      user.status === 'approved' ? 'bg-green-100 text-green-700' :
                      user.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {user.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
