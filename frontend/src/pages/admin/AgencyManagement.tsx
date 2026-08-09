import { useEffect, useState } from 'react'
import axios from 'axios'

interface Agency {
  id: number
  name: string
  cases: number
  status: string
}

export default function AgencyManagement() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<Agency | null>(null)

  useEffect(() => {
    fetchAgencies()
  }, [])

  const fetchAgencies = () => {
    axios.get('/api/admin/agencies')
      .then(r => setAgencies(r.data))
      .catch(() => setMessage('❌ Failed to load agencies'))
  }

  const filtered = agencies.filter(a => filter === 'all' || a.status === filter)

  const createAgency = async () => {
    if (!newName.trim()) return
    try {
      const res = await axios.post('/api/admin/agencies', { name: newName })
      setAgencies([...agencies, res.data])
      setShowModal(false)
      setNewName('')
      setMessage('✅ Agency created successfully')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('❌ Failed to create agency')
    }
  }

  const toggleStatus = async (agency: Agency) => {
    const newStatus = agency.status === 'active' ? 'inactive' : 'active'
    // In production, this would call PUT /api/admin/agencies/{id}
    setAgencies(agencies.map(a => a.id === agency.id ? { ...a, status: newStatus } : a))
    setMessage(`✅ ${agency.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-amber-500">🏢 Agency Management</h1>
          <p className="text-gray-400">{agencies.length} registered agencies</p>
        </div>
        <div className="flex gap-3">
          <select
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
            value={filter} onChange={e => setFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            className="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg font-bold transition-colors"
            onClick={() => setShowModal(true)}
          >
            + Add Agency
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl mb-4 font-bold text-center ${
          message.includes('✅') ? 'bg-green-900/50 text-green-300 border border-green-700' :
          'bg-red-900/50 text-red-300 border border-red-700'
        }`}>
          {message}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <p className="text-5xl mb-4">🏢</p>
          <h2 className="text-xl font-bold mb-2">No Agencies Found</h2>
          <p className="text-gray-400">Click "+ Add Agency" to register one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(agency => (
            <div key={agency.id} className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-amber-500/50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold">{agency.name}</h3>
                  <p className="text-sm text-gray-400">ID: #{agency.id}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  agency.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {agency.status === 'active' ? '● Active' : '● Inactive'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-gray-900 px-3 py-2 rounded-lg">
                  <p className="text-xs text-gray-400">Active Cases</p>
                  <p className="text-xl font-bold text-amber-400">{agency.cases}</p>
                </div>
                <div className="bg-gray-900 px-3 py-2 rounded-lg">
                  <p className="text-xs text-gray-400">Resolved</p>
                  <p className="text-xl font-bold text-green-400">{Math.floor(agency.cases * 0.6)}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">
                  Assign Cases
                </button>
                <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">
                  Settings
                </button>
                <button
                  className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                    agency.status === 'active'
                      ? 'bg-red-900 hover:bg-red-800 text-red-300'
                      : 'bg-green-900 hover:bg-green-800 text-green-300'
                  }`}
                  onClick={() => toggleStatus(agency)}
                >
                  {agency.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Agency Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">➕ Add New Agency</h2>
            <input
              className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg mb-4 text-white focus:border-amber-500 outline-none"
              placeholder="Enter agency name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && createAgency()}
            />
            <div className="flex gap-3 justify-end">
              <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg font-bold transition-colors"
                onClick={createAgency}
                disabled={!newName.trim()}
              >
                Create Agency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
