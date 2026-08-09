import { useEffect, useState } from 'react'
import axios from 'axios'

interface User {
  name: string
  email: string
  role: string
  cases?: number
  lastActive?: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    axios.get('/api/admin/users').then(r => setUsers(r.data))
  }, [])

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">👥 User Management</h1>
          <p className="text-gray-400">{users.length} approved investigators</p>
        </div>
        <input className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 w-64"
          placeholder="🔍 Search users..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        {[
          { role: 'Investigators', count: users.filter(u => u.role === 'investigator').length, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.role} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm">{s.role}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700 text-left">
              <th className="p-4 text-gray-400 font-medium">Name</th>
              <th className="p-4 text-gray-400 font-medium">Email</th>
              <th className="p-4 text-gray-400 font-medium">Role</th>
              <th className="p-4 text-gray-400 font-medium">Cases</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filtered.map(user => (
              <tr key={user.email} className="hover:bg-gray-750 transition-colors">
                <td className="p-4 font-medium">{user.name}</td>
                <td className="p-4 text-gray-400">{user.email}</td>
                <td className="p-4"><span className="px-2 py-1 rounded text-xs font-bold bg-purple-900 text-purple-300">investigator</span></td>
                <td className="p-4 text-gray-400">{user.cases || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
